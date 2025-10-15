// networkingController.js - PostgreSQL version
const { pool } = require('./db');

// Ensure connections_count column exists in profiles table
async function ensureConnectionsCountColumn() {
  try {
    const result = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns
      WHERE table_name = 'profiles' AND column_name = 'connections_count';
    `);

    if (result.rows.length === 0) {
      console.log('Adding missing connections_count column to profiles table...');
      await pool.query(`ALTER TABLE profiles ADD COLUMN connections_count INTEGER DEFAULT 0;`);

      // Initialize counts for existing users
      await pool.query(`
        UPDATE profiles p
        SET connections_count = (
          SELECT COUNT(*) FROM connections c
          WHERE (c.user1_id = p.user_id OR c.user2_id = p.user_id)
          AND c.status = 'accepted'
        );
      `);
      console.log('connections_count column added and initialized.');
    }
  } catch (error) {
    console.error('Error ensuring connections_count column:', error);
  }
}
ensureConnectionsCountColumn();

// --- Send connection request ---
async function sendConnectionRequest(req, res) {
  try {
    const fromUserId = req.user.id;
    const { toUserId, message } = req.body;

    if (!toUserId) return res.status(400).json({ error: 'Recipient user ID is required' });
    if (fromUserId === parseInt(toUserId))
      return res.status(400).json({ error: 'Cannot send request to yourself' });

    const existing = await pool.query(
      `SELECT * FROM connection_requests 
       WHERE from_user_id = $1 AND to_user_id = $2 AND status = 'pending'`,
      [fromUserId, toUserId]
    );
    if (existing.rowCount > 0)
      return res.status(400).json({ error: 'Connection request already sent' });

    const connected = await pool.query(
      `SELECT * FROM connections 
       WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)`,
      [fromUserId, toUserId]
    );
    if (connected.rowCount > 0)
      return res.status(400).json({ error: 'Already connected with this user' });

    const result = await pool.query(
      `INSERT INTO connection_requests (from_user_id, to_user_id, message, status)
       VALUES ($1, $2, $3, 'pending') RETURNING id`,
      [fromUserId, toUserId, message || '']
    );

    res.json({ success: true, message: 'Connection request sent', requestId: result.rows[0].id });
  } catch (err) {
    console.error('Error sending connection request:', err);
    res.status(500).json({ error: 'Server error while sending connection request' });
  }
}

// --- Accept connection request ---
async function acceptConnectionRequest(req, res) {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const { requestId } = req.body;

    const requestRes = await client.query(
      `SELECT * FROM connection_requests 
       WHERE id = $1 AND to_user_id = $2 AND status = 'pending'`,
      [requestId, userId]
    );
    if (requestRes.rowCount === 0)
      return res.status(404).json({ error: 'Connection request not found' });

    const request = requestRes.rows[0];
    const user1_id = Math.min(request.from_user_id, request.to_user_id);
    const user2_id = Math.max(request.from_user_id, request.to_user_id);

    await client.query('BEGIN');
    await client.query(
      `UPDATE connection_requests 
       SET status = 'accepted', updated_at = NOW() 
       WHERE id = $1`,
      [requestId]
    );
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

    res.json({ success: true, message: 'Connection accepted' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error accepting connection:', err);
    res.status(500).json({ error: 'Server error while accepting connection' });
  } finally {
    client.release();
  }
}

// --- Reject connection request ---
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
  } catch (err) {
    console.error('Error rejecting connection:', err);
    res.status(500).json({ error: 'Server error while rejecting connection' });
  }
}

// --- Withdraw connection request ---
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
  } catch (err) {
    console.error('Error withdrawing request:', err);
    res.status(500).json({ error: 'Server error while withdrawing connection request' });
  }
}

// --- Get pending requests ---
async function getPendingRequests(req, res) {
  try {
    const userId = req.user.id;
    const { rows } = await pool.query(
      `SELECT cr.*, u.name, u.email, p.headline, p.avatar_url 
       FROM connection_requests cr
       JOIN users u ON u.id = cr.from_user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE cr.to_user_id = $1 AND cr.status = 'pending'
       ORDER BY cr.created_at DESC`,
      [userId]
    );
    res.json({ requests: rows });
  } catch (err) {
    console.error('Error fetching pending requests:', err);
    res.status(500).json({ error: 'Server error while fetching requests' });
  }
}

// --- Get user connections ---
async function getUserConnections(req, res) {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const { rows } = await pool.query(
      `SELECT u.id, u.name, p.headline, p.location, p.avatar_url, c.created_at AS connected_since
       FROM connections c
       JOIN users u ON (u.id = c.user1_id OR u.id = c.user2_id) AND u.id != $1
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE (c.user1_id = $1 OR c.user2_id = $1) AND c.status = 'accepted'
       ORDER BY c.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    res.json({ connections: rows, count: rows.length, limit, offset });
  } catch (err) {
    console.error('Error fetching user connections:', err);
    res.status(500).json({ error: 'Server error while fetching connections' });
  }
}

// --- Remove connection ---
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
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error removing connection:', err);
    res.status(500).json({ error: 'Server error while removing connection' });
  } finally {
    client.release();
  }
}

// --- Connection suggestions ---
async function getConnectionSuggestions(req, res) {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 12;

    const { rows } = await pool.query(
      `SELECT DISTINCT u.id, u.name, p.headline, p.location, p.avatar_url
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id != $1
       AND u.id NOT IN (
         SELECT CASE WHEN c.user1_id = $1 THEN c.user2_id ELSE c.user1_id END
         FROM connections c
         WHERE (c.user1_id = $1 OR c.user2_id = $1) AND c.status = 'accepted'
       )
       AND u.id NOT IN (
         SELECT CASE WHEN cr.from_user_id = $1 THEN cr.to_user_id ELSE cr.from_user_id END
         FROM connection_requests cr
         WHERE (cr.from_user_id = $1 OR cr.to_user_id = $1) AND cr.status = 'pending'
       )
       ORDER BY RANDOM()
       LIMIT $2`,
      [userId, limit]
    );

    res.json({ suggestions: rows });
  } catch (err) {
    console.error('Error fetching connection suggestions:', err);
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
  removeConnection,
  getConnectionSuggestions
};
