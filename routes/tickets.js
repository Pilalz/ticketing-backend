const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Get all meeting schedules (for Monitor)
router.get('/', async (req, res) => {
  try {
    const allowedStatuses = ['Waiting', 'In The Room'];

    let query = `
      SELECT 
        ms.rowid,
        ms.date,
        ms.time,
        ms.subject,
        ms.status,
        ms.response,
        json_agg(
          json_build_object(
            'rowid', mp.rowid,
            'person_rowid', mp.person_rowid,
            'name', mp.name
          )
        ) FILTER (WHERE mp.rowid IS NOT NULL) as participants
      FROM "meetingSchedule" ms
      LEFT JOIN "meetingParticipants" mp ON ms.rowid = mp."meetingSchedule_rowid"
      WHERE 
        ms.status = ANY($1)
    `;

    const params = [allowedStatuses];

    query += `
      GROUP BY ms.rowid
      ORDER BY ms.time ASC
    `;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Get meeting schedules error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// GET ALL TICKETS (UNTUK ADMIN) - Tanpa Filter Tanggal
router.get('/all', async (req, res) => {
  try {
    const query = `
      SELECT 
        ms.rowid,
        ms.date,
        ms.time,
        ms.subject,
        ms.status,
        ms.response,
        json_agg(
          json_build_object(
            'name', mp.name
          )
        ) FILTER (WHERE mp.rowid IS NOT NULL) as participants
      FROM "meetingSchedule" ms
      LEFT JOIN "meetingParticipants" mp ON ms.rowid = mp."meetingSchedule_rowid"
      GROUP BY ms.rowid
      ORDER BY ms.date DESC, ms.time ASC
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Get all tickets error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// TAMBAH TICKET BARU (POST)
router.post('/', async (req, res) => {
  const client = await pool.connect(); // Ambil 1 koneksi khusus
  
  try {
    const { date, time, subject, participants } = req.body;

    await client.query('BEGIN');

    const scheduleQuery = `
      INSERT INTO "meetingSchedule" (date, time, subject, status, response)
      VALUES ($1, $2, $3, 'Waiting', '')
      RETURNING rowid
    `;
    const scheduleResult = await client.query(scheduleQuery, [date, time, subject]);
    const meetingId = scheduleResult.rows[0].rowid;

    // 3. Insert ke Tabel Peserta (Children) - Jika ada pesertanya
    if (participants && participants.length > 0) {
      const participantQuery = `
        INSERT INTO "meetingParticipants" ("meetingSchedule_rowid", name, person_rowid)
        VALUES ($1, $2, $3)
      `;
      
      for (const name of participants) {
        // person_rowid kita isi null atau random string dulu jika tidak ada tabel master person
        await client.query(participantQuery, [meetingId, name, null]); 
      }
    }

    // 4. Commit (Simpan Permanen)
    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Ticket created successfully',
      data: { rowid: meetingId }
    });

  } catch (error) {
    // 5. Rollback (Batalkan semua jika ada error)
    await client.query('ROLLBACK');
    console.error('Create ticket error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create ticket', 
      error: error.message 
    });
  } finally {
    // 6. Lepaskan koneksi kembali ke pool
    client.release();
  }
});

// EDIT TICKET (PUT)
router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { date, time, subject, participants } = req.body;

    await client.query('BEGIN'); // Mulai Transaksi

    // 1. Update Tabel Utama (Schedule)
    const updateQuery = `
      UPDATE "meetingSchedule"
      SET date = $1, time = $2, subject = $3
      WHERE rowid = $4
    `;
    await client.query(updateQuery, [date, time, subject, id]);

    // 2. Hapus SEMUA peserta lama untuk meeting ini
    const deleteParticipantsQuery = `
      DELETE FROM "meetingParticipants"
      WHERE "meetingSchedule_rowid" = $1
    `;
    await client.query(deleteParticipantsQuery, [id]);

    // 3. Masukkan ulang peserta baru (jika ada)
    if (participants && participants.length > 0) {
      const insertParticipantQuery = `
        INSERT INTO "meetingParticipants" ("meetingSchedule_rowid", name)
        VALUES ($1, $2)
      `;
      
      for (const name of participants) {
        await client.query(insertParticipantQuery, [id, name]);
      }
    }

    await client.query('COMMIT'); // Simpan permanen

    res.json({
      success: true,
      message: 'Ticket updated successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK'); // Batalkan jika error
    console.error('Update ticket error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update ticket', 
      error: error.message 
    });
  } finally {
    client.release();
  }
});

// Get single meeting schedule by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        ms.rowid,
        ms.date,
        ms.time,
        ms.subject,
        ms.status,
        ms.response,
        json_agg(
          json_build_object(
            'rowid', mp.rowid,
            'person_rowid', mp.person_rowid,
            'name', mp.name
          )
        ) FILTER (WHERE mp.rowid IS NOT NULL) as participants
      FROM "meetingSchedule" ms
      LEFT JOIN "meetingParticipants" mp ON ms.rowid = mp."meetingSchedule_rowid"
      WHERE ms.rowid = $1
      GROUP BY ms.rowid, ms.date, ms.time, ms.subject, ms.status, ms.response
    `;
    
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Meeting schedule not found' 
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get meeting schedule error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Update status
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['Waiting', 'In The Room', 'Finished', 'Overdue', 'Reject'];
    
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    const result = await pool.query(
      `UPDATE "meetingSchedule" 
       SET status = $1
       WHERE rowid = $2
       RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Meeting schedule not found' 
      });
    }

    res.json({
      success: true,
      message: 'Status updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get dashboard statistics
router.get('/stats/dashboard', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const statsResult = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'scheduled' AND date = $1) as scheduled,
        COUNT(*) FILTER (WHERE status = 'in_progress' AND date = $1) as in_progress,
        COUNT(*) FILTER (WHERE status = 'completed' AND date = $1) as completed,
        COUNT(*) FILTER (WHERE status = 'cancelled' AND date = $1) as cancelled,
        COUNT(*) FILTER (WHERE date = $1) as total_today,
        COUNT(*) as total_all
       FROM "meetingSchedule"`,
      [today]
    );

    res.json({
      success: true,
      data: statsResult.rows[0]
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;