const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Get all tickets (accessible by both secretary and director)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, date } = req.query;
    let query = `
      SELECT t.*, u.full_name as created_by_name 
      FROM tickets t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND t.status = $${params.length}`;
    }

    if (date) {
      params.push(date);
      query += ` AND DATE(t.appointment_time) = $${params.length}`;
    }

    query += ' ORDER BY t.appointment_time ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single ticket
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT t.*, u.full_name as created_by_name 
       FROM tickets t
       LEFT JOIN users u ON t.created_by = u.id
       WHERE t.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create ticket (only secretary)
router.post('/', authenticateToken, authorizeRole('secretary'), async (req, res) => {
  try {
    const { guest_name, company, phone, email, purpose, appointment_time } = req.body;

    // Validate required fields
    if (!guest_name || !purpose || !appointment_time) {
      return res.status(400).json({ message: 'Guest name, purpose, and appointment time are required' });
    }

    const result = await pool.query(
      `INSERT INTO tickets (guest_name, company, phone, email, purpose, appointment_time, created_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'waiting')
       RETURNING *`,
      [guest_name, company, phone, email, purpose, appointment_time, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update ticket (only secretary)
router.put('/:id', authenticateToken, authorizeRole('secretary'), async (req, res) => {
  try {
    const { id } = req.params;
    const { guest_name, company, phone, email, purpose, appointment_time, status } = req.body;

    const result = await pool.query(
      `UPDATE tickets 
       SET guest_name = $1, company = $2, phone = $3, email = $4, 
           purpose = $5, appointment_time = $6, status = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [guest_name, company, phone, email, purpose, appointment_time, status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update ticket status (secretary can update to any status)
router.patch('/:id/status', authenticateToken, authorizeRole('secretary', 'director'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['waiting', 'in_room', 'completed', 'cancelled', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const result = await pool.query(
      `UPDATE tickets 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete ticket (only secretary)
router.delete('/:id', authenticateToken, authorizeRole('secretary'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM tickets WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    res.json({ message: 'Ticket deleted successfully' });
  } catch (error) {
    console.error('Delete ticket error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get dashboard statistics
router.get('/stats/dashboard', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const statsResult = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'waiting' AND DATE(appointment_time) = $1) as waiting,
        COUNT(*) FILTER (WHERE status = 'in_room' AND DATE(appointment_time) = $1) as in_room,
        COUNT(*) FILTER (WHERE status = 'completed' AND DATE(appointment_time) = $1) as completed,
        COUNT(*) FILTER (WHERE DATE(appointment_time) = $1) as total_today
       FROM tickets`,
      [today]
    );

    res.json(statsResult.rows[0]);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
