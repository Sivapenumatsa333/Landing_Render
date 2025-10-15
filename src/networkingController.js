// networkingController.js - PostgreSQL version for Render
const { pool } = require('./db');

// --- Helper: ensure connections_count column exists in profiles table ---
async function ensureConnectionsCountColumn() {
  try {
    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'connections_count';
    `);

    if (result.rows.length === 0) {
      console.log('Adding missing connections_count column to profiles table...');
      await pool.query(`ALTER TABLE profiles ADD COLUMN connections_count INTEGER DEFAULT 0;`);

      await pool.query(`
        UPDATE profiles p
        SET connections_count = (
          SELECT COUNT(*) 
          FROM connections c
          WHERE (c.user1_id = p.user_id OR c.user2_id = p.user_id)
            AND c.status = 'accepted'
        );
      `);
      console.log('connections_count column added and initialized');
    }
  } catch (error) {
    console.error('Error ensuring connections_count column:', error);
  }
}

ensureConnectionsCountColumn();

// --- Send Connection Request ---
async function sendConnectionRequest(req, res) {
  try {
    const fromUserId = req.user.id;
    const { toUserId, message } = req.body;

    if (!toUserId)
      return res.status(400).json({ error: 'Recipient user ID is required' });

    if (fromUserId === parseInt(toUserId))
      return res.status(400).json({ error: 'Cannot send connection request to yourself' });

    const existing = await pool.query(
      `SELECT * FROM connection_requests 
       WHERE from_user_id = $1 AND to_user_id = $2 AND status = 'pending'`,
      [fromUserId, toUserId]
    );
    if (existing.rows.length > 0)
      return res.status(400).json({ error: 'Connection request already sent' });

    const connected = await pool.query(
      `SELECT * FROM connections 
       WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)`,
      [fromUserId, toUserId]
    );
    if (connected.rows.length > 0)
      return res.status(400).json({ error: 'Already connected with this user' });

    const result = await pool.query(
      `INSERT INTO connection_requests (from_user_id, to_user_id, message, status)
       VALUES ($1, $2, $3, 'pending') RETURNING id`,
      [fromUserId, toUserId, message || '']
    );

    res.json({
      success: true,
      message: 'Connection request sent successfully',
      requestId: result.rows[0].id
    });
  } catch (error) {
    console.error('Error sending connection request:', error);
    res.status(500).json({ error: 'Server error while sending connection request' });
  }
}

// --- Accept Connection Request ---
async function acceptConnectionRequest(req, res) {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const { requestId } = req.body;

    const requestResult = await client.query(
      `SELECT * FROM connection_requests
       WHERE id = $1 AND to_user_id = $2 AND status = 'pending'`,
      [requestId, userId]
    );
    if (requestResult.rows.length === 0)
      return res.status(404).json({ error: 'Connection request not found' });

    const request = requestResult.rows[0];

    await client.query('BEGIN');

    await client.query(
      `UPDATE connection_requests
       SET status = 'accepted', updated_at = NOW()
       WHERE id = $1`,
      [requestId]
    );

    const user1_id = Math.min(request.from_user_id, request.to_user_id);
    const user2_id = Math.max(request.from_user_id, request.to_user_id);

    await client.query(
      `INSERT INTO connections (user1_id, user2_id, status)
       VALUES ($1, $2, 'accepted')`,
      [user1_id, user2_id]
    );

    await client.query(
      `UPDATE profiles
       SET connections_count = COALESCE(connections_count, 0) + 1
       WHERE user_id IN ($1, $2)`,
      [request.from_user_id, request.to_user_id]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Connection request accepted' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error accepting connection request:', error);
    res.status(500).json({ error: 'Server error while accepting connection request' });
  } finally {
    client.release();
  }
}

// --- Reject Connection Request ---
async function rejectConnectionRequest(req, res) {
  try {
    const userId = req.user.id;
    const { requestId } = req.body;

    const result = await pool.query(
      `UPDATE connection_requests
       SET status = 'rejected', updated_at = NOW()
       WHERE id = $1 AND to_user_id = $2 AND status = 'pending'`,
      [requestId, userId]
    );

    if (result.rowCount === 0)
      return res.status(404).json({ error: 'Connection request not found' });

    res.json({ success: true, message: 'Connection request rejected' });
  } catch (error) {
    console.error('Error rejecting connection request:', error);
    res.status(500).json({ error: 'Server error while rejecting connection request' });
  }
}

// --- Withdraw Connection Request ---
async function withdrawConnectionRequest(req, res) {
  try {
    const userId = req.user.id;
    const { requestId } = req.body;

    const result = await pool.query(
      `UPDATE connection_requests
       SET status = 'withdrawn', updated_at = NOW()
       WHERE id = $1 AND from_user_id = $2 AND status = 'pending'`,
      [requestId, userId]
    );

    if (result.rowCount === 0)
      return res.status(404).json({ error: 'Connection request not found' });

    res.json({ success: true, message: 'Connection request withdrawn' });
  } catch (error) {
    console.error('Error withdrawing connection request:', error);
    res.status(500).json({ error: 'Server error while withdrawing connection request' });
  }
}

// --- Get Pending Requests ---
async function getPendingRequests(req, res) {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT cr.*, u.name, u.email, p.headline, p.avatar_url
       FROM connection_requests cr
       JOIN users u ON u.id = cr.from_user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE cr.to_user_id = $1 AND cr.status = 'pending'
       ORDER BY cr.created_at DESC`,
      [userId]
    );
    res.json({ requests: result.rows });
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    res.status(500).json({ error: 'Server error while fetching connection requests' });
  }
}

// --- Get User Connections ---
async function getUserConnections(req, res) {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const sql = `
      SELECT u.id, u.name, p.headline, p.location, p.avatar_url, c.created_at AS connected_since
      FROM connections c
      JOIN users u ON (u.id = c.user1_id OR u.id = c.user2_id) AND u.id != $1
      LEFT JOIN profiles p ON p.user_id = u.id
      WHERE (c.user1_id = $1 OR c.user2_id = $1) AND c.status = 'accepted'
      ORDER BY c.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(sql, [userId, limit, offset]);
    res.json({
      connections: result.rows,
      count: result.rowCount,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching user connections:', error);
    res.status(500).json({ error: 'Server error while fetching connections' });
  }
}

// --- Check Connection Status ---
async function checkConnectionStatus(req, res) {
  try {
    const userId = req.user.id;
    const otherUserId = parseInt(req.params.otherUserId);

    const connections = await pool.query(
      `SELECT * FROM connections
       WHERE ((user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1))
       AND status = 'accepted'`,
      [userId, otherUserId]
    );

    const sent = await pool.query(
      `SELECT * FROM connection_requests
       WHERE from_user_id = $1 AND to_user_id = $2 AND status = 'pending'`,
      [userId, otherUserId]
    );
    const received = await pool.query(
      `SELECT * FROM connection_requests
       WHERE from_user_id = $1 AND to_user_id = $2 AND status = 'pending'`,
      [otherUserId, userId]
    );

    const status = {
      isConnected: connections.rows.length > 0,
      connectionSent: sent.rows.length > 0,
      connectionReceived: received.rows.length > 0,
      sentRequestId: sent.rows[0]?.id || null,
      receivedRequestId: received.rows[0]?.id || null
    };
    res.json(status);
  } catch (error) {
    console.error('Error checking connection status:', error);
    res.status(500).json({ error: 'Server error while checking connection status' });
  }
}

// --- Remove Connection ---
async function removeConnection(req, res) {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const { connectionUserId } = req.body;

    await client.query('BEGIN');

    const result = await client.query(
      `DELETE FROM connections
       WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)`,
      [userId, connectionUserId]
    );

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Connection not found' });
    }

    await client.query(
      `UPDATE profiles
       SET connections_count = GREATEST(0, COALESCE(connections_count, 0) - 1)
       WHERE user_id IN ($1, $2)`,
      [userId, connectionUserId]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Connection removed successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error removing connection:', error);
    res.status(500).json({ error: 'Server error while removing connection' });
  } finally {
    client.release();
  }
}

// --- Get Connection Suggestions ---
async function getConnectionSuggestions(req, res) {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 12;

    const sql = `
      SELECT DISTINCT u.id, u.name, p.headline, p.location, p.avatar_url
      FROM users u
      LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.id != $1
      AND u.id NOT IN (
        SELECT CASE
          WHEN c.user1_id = $1 THEN c.user2_id
          WHEN c.user2_id = $1 THEN c.user1_id
        END AS connected_user
        FROM connections c
        WHERE (c.user1_id = $1 OR c.user2_id = $1) AND c.status = 'accepted'
      )
      AND u.id NOT IN (
        SELECT CASE
          WHEN cr.from_user_id = $1 THEN cr.to_user_id
          WHEN cr.to_user_id = $1 THEN cr.from_user_id
        END AS requested_user
        FROM connection_requests cr
        WHERE (cr.from_user_id = $1 OR cr.to_user_id = $1) AND cr.status = 'pending'
      )
      ORDER BY RANDOM()
      LIMIT $2;
    `;
    const result = await pool.query(sql, [userId, limit]);
    res.json({ suggestions: result.rows });
  } catch (error) {
    console.error('Error fetching connection suggestions:', error);
    res.status(500).json({ error: 'Server error while fetching suggestions' });
  }
}

module.exports = {
  sendConnectionRequest,
  acceptConnectionRequest,
  rejectConnectionRequest,
  withdrawConnectionRequest,
  getPendingRequests,
  getUserConnections,
  checkConnectionStatus,
  removeConnection,
  getConnectionSuggestions
};
