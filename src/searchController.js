// src/searchController.js
const { pool } = require('./db'); // This should now be pg.Pool

// Helper: sanitize and limit values
function sanitizeQuery(qRaw) {
  if (!qRaw) return '';
  return qRaw.trim().slice(0, 100);
}

// GET /api/search?q=term&limit=20&offset=0
async function searchProfiles(req, res) {
  try {
    const qRaw = req.query.q || '';
    const q = sanitizeQuery(qRaw);
    if (!q) return res.status(400).json({ error: 'Query required' });

    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

    const qLike = `%${q}%`;

    // PostgreSQL uses ILIKE (case-insensitive) instead of LIKE
    const sql = `
      SELECT DISTINCT
        u.id, u.name, p.headline, p.location
      FROM users u
      LEFT JOIN profiles p ON p.user_id = u.id
      LEFT JOIN skills s ON s.user_id = u.id
      WHERE u.name ILIKE $1 
         OR p.headline ILIKE $1 
         OR p.about ILIKE $1 
         OR s.name ILIKE $1 
         OR p.location ILIKE $1
      ORDER BY u.name ASC
      LIMIT $2 OFFSET $3;
    `;

    const { rows } = await pool.query(sql, [qLike, limit, offset]);

    if (rows.length > 0) {
      const userIds = rows.map(r => r.id);
      const skillsSql = `
        SELECT user_id, STRING_AGG(name, ', ') AS skills
        FROM skills
        WHERE user_id = ANY($1)
        GROUP BY user_id;
      `;
      const { rows: skillsRows } = await pool.query(skillsSql, [userIds]);

      const skillsMap = {};
      skillsRows.forEach(r => {
        skillsMap[r.user_id] = r.skills;
      });

      rows.forEach(r => {
        r.skills = skillsMap[r.id] || '';
      });
    }

    res.json({ results: rows, count: rows.length, limit, offset });
  } catch (err) {
    console.error('Error searching profiles:', err);
    res.status(500).json({ error: 'Server error while searching profiles' });
  }
}

// Suggestions endpoint (for typeahead)
async function searchSuggestions(req, res) {
  try {
    const qRaw = req.query.q || '';
    const q = sanitizeQuery(qRaw);
    if (!q) return res.json({ suggestions: [] });

    const qLike = `%${q}%`;

    const sql = `
      SELECT DISTINCT u.id, u.name, p.headline
      FROM users u
      LEFT JOIN profiles p ON p.user_id = u.id
      LEFT JOIN skills s ON s.user_id = u.id
      WHERE u.name ILIKE $1 OR p.headline ILIKE $1 OR s.name ILIKE $1
      ORDER BY u.name ASC
      LIMIT 10;
    `;

    const { rows } = await pool.query(sql, [qLike]);
    res.json({ suggestions: rows });
  } catch (err) {
    console.error('Error fetching suggestions:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { searchProfiles, searchSuggestions };
