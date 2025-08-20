const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve uploaded images

// Multer storage setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'lv33global'
});

// Connect to MySQL
db.connect(err => {
  if (err) {
    console.error('❌ MySQL connection failed:', err);
    process.exit(1);
  }
  console.log('✅ Connected to MySQL database');
});

// Signup API
app.post('/api/signup', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    const [existing] = await db.promise().query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.promise().query(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );

    res.json({ message: 'Signup successful!' });
  } catch (error) {
    console.error('Error during signup:', error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});

// Login API
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    const [users] = await db.promise().query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const user = users[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    res.status(200).json({ message: 'Login successful' });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});

// ✅ Create Post API
app.post('/api/create-post', upload.single('image'), async (req, res) => {
  const { title, content, link, category } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : null;

  if (!title || !content || !image) {
    return res.status(400).json({ message: 'Title, content, and image are required.' });
  }

  try {
   await db.promise().query(
  'INSERT INTO posts (title, content, link, image, category) VALUES (?, ?, ?, ?, ?)',
  [title, content, link, image, category]
);

    res.status(201).json({ message: 'Post created successfully!' });
  } catch (error) {
    console.error('Error saving post:', error);
    res.status(500).json({ message: 'Server error while saving post.' });
  }
});

// ✅ Fetch posts
app.get('/api/posts', async (req, res) => {
  try {
    const [rows] = await db.promise().query('SELECT * FROM posts ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ message: 'Error fetching posts' });
  }
});

// ✅ Save updated casino info
app.post('/api/update-casino', upload.single('logo'), async (req, res) => {
  console.log("🚀 Incoming Casino Edit Submission:", req.body);
  console.log("📁 Uploaded File:", req.file);

  const { id, label1, label2, country, website, ranking } = req.body;

  if (!id) {
    return res.status(400).json({ message: 'Casino ID is required for updating.' });
  }

  const payments = Array.isArray(req.body['payments[]'])
    ? req.body['payments[]']
    : [req.body['payments[]']];

  const logo = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    // Check if casino with given ID exists
    const [existingRows] = await db.promise().query('SELECT * FROM casinos WHERE id = ?', [id]);
    if (existingRows.length === 0) {
      return res.status(404).json({ message: 'Casino not found.' });
    }

    const updateQuery = logo
      ? 'UPDATE casinos SET label1=?, label2=?, country=?, website=?, logo=?, payments=?, ranking=? WHERE id=?'
      : 'UPDATE casinos SET label1=?, label2=?, country=?, website=?, payments=?, ranking=? WHERE id=?';

    const values = logo
      ? [label1, label2, country, website, logo, JSON.stringify(payments), ranking, id]
      : [label1, label2, country, website, JSON.stringify(payments), ranking, id];

    await db.promise().query(updateQuery, values);

    res.status(200).json({ message: 'Casino updated successfully!' });
  } catch (error) {
    console.error('Error updating casino info:', error);
    res.status(500).json({ message: 'Server error while updating casino.' });
  }
});



// ✅ Get list of all casinos
app.get('/api/casino-list', async (req, res) => {
  try {
    const [rows] = await db.promise().query('SELECT * FROM casinos ORDER BY ranking ASC');
    const formatted = rows.map(c => ({
      ...c,
      payments: JSON.parse(c.payments)
    }));
    res.json(formatted);
  } catch (error) {
    console.error('Error fetching casinos:', error);
    res.status(500).json({ message: 'Error fetching casino list' });
  }
});
// 🆕 Endpoint to get only casino betting news posts
app.get('/api/posts/casino-news', async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      'SELECT * FROM posts WHERE category = ? ORDER BY created_at DESC',
      ['casino_betting_news']
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching casino news:', error);
    res.status(500).json({ message: 'Error fetching casino news' });
  }
});
app.get('/api/posts/featured-news', async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      'SELECT * FROM posts WHERE category = ? ORDER BY created_at DESC',
      ['featured_news']
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching featured news:', error);
    res.status(500).json({ message: 'Error fetching featured news' });
  }
});
// 🆕 Create Game API
app.post('/api/create-game', upload.single('image'), async (req, res) => {
  const { title, link } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : null;

  if (!title || !link || !image) {
    return res.status(400).json({ message: 'Title, link, and image are required.' });
  }

  try {
    await db.promise().query(
      'INSERT INTO games (title, link, image) VALUES (?, ?, ?)',
      [title, link, image]
    );

    res.status(201).json({ message: 'Game added successfully!' });
  } catch (error) {
    console.error('❌ Error saving game:', error);
    res.status(500).json({ message: 'Server error while saving game.' });
  }
});
// 🆕 Get All Games
app.get('/api/games', async (req, res) => {
  try {
    const [rows] = await db.promise().query('SELECT * FROM games ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error('❌ Error fetching games:', error);
    res.status(500).json({ message: 'Error fetching games' });
  }
});
// Update Game
app.post('/api/update-game/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { title, link } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const [existing] = await db.promise().query('SELECT * FROM games WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ message: 'Game not found.' });

    const updateQuery = image
      ? 'UPDATE games SET title = ?, link = ?, image = ? WHERE id = ?'
      : 'UPDATE games SET title = ?, link = ? WHERE id = ?';

    const values = image ? [title, link, image, id] : [title, link, id];

    await db.promise().query(updateQuery, values);
    res.status(200).json({ message: 'Game updated successfully!' });
  } catch (err) {
    console.error('Update game error:', err);
    res.status(500).json({ message: 'Server error during game update.' });
  }
});

// Delete Game
app.delete('/api/delete-game/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.promise().query('SELECT * FROM games WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Game not found.' });

    const imagePath = rows[0].image;
    if (imagePath) {
      const fs = require('fs');
      const path = `.${imagePath}`;
      if (fs.existsSync(path)) {
        fs.unlinkSync(path);
      }
    }

    await db.promise().query('DELETE FROM games WHERE id = ?', [id]);
    res.status(200).json({ message: 'Game deleted successfully.' });
  } catch (err) {
    console.error('❌ Error deleting game:', err);
    res.status(500).json({ message: 'Server error while deleting game.' });
  }
});
// --------- Global Lucky Slot CRUD ---------

// Create
app.post('/api/create-global-slot', upload.single('image'), async (req, res) => {
  const { name, promo, score, stars, link } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : null;

  // ✅ Correctly handle checkbox array
let rawPayments = req.body.payments || req.body['payments[]'] || [];
if (!Array.isArray(rawPayments)) rawPayments = [rawPayments];
const payments = JSON.stringify(rawPayments);

  try {
    await db.promise().query(
      'INSERT INTO global_slots (name, promo, score, stars, link, image, payments) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, promo, score, stars, link, image, payments]
    );
    res.status(201).json({ message: 'Global Lucky Slot created successfully!' });
  } catch (err) {
    console.error('Error creating global slot:', err);
    res.status(500).json({ message: 'Server error while creating global slot.' });
  }
});


// Read (list all)
app.get('/api/global-slots', async (req, res) => {
  try {
    const [rows] = await db.promise().query('SELECT * FROM global_slots ORDER BY created_at DESC');
    const formatted = rows.map(r => ({ ...r, payments: r.payments ? JSON.parse(r.payments) : [] }))

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching global slots:', err);
    res.status(500).json({ message: 'Error fetching global slots' });
  }
});

// Update
app.post('/api/update-global-slot/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { name, promo, score, stars, link } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : null;
  
let rawPayments = req.body.payments || req.body['payments[]'] || [];
if (!Array.isArray(rawPayments)) rawPayments = [rawPayments];
const payments = JSON.stringify(rawPayments);


  try {
    const [existing] = await db.promise().query('SELECT * FROM global_slots WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ message: 'Global Lucky Slot not found.' });

    const updateQuery = image
      ? 'UPDATE global_slots SET name=?, promo=?, score=?, stars=?, link=?, image=?, payments=? WHERE id=?'
      : 'UPDATE global_slots SET name=?, promo=?, score=?, stars=?, link=?, payments=? WHERE id=?';

    const values = image
      ? [name, promo, score, stars, link, image, JSON.stringify(payments), id]
      : [name, promo, score, stars, link, JSON.stringify(payments), id];

    await db.promise().query(updateQuery, values);
    res.status(200).json({ message: 'Global Lucky Slot updated successfully!' });
  } catch (err) {
    console.error('Error updating global slot:', err);
    res.status(500).json({ message: 'Server error during update.' });
  }
});


// Delete
app.delete('/api/delete-global-slot/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ message: 'ID is required.' });

  try {
    const [rows] = await db.promise().query('SELECT * FROM global_slots WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Global Lucky Slot not found.' });
    }

    // (optional) delete the image file from disk
    const fs = require('fs');
    const img = rows[0].image;
    if (img) {
      const p = `.${img}`;
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }

    await db.promise().query('DELETE FROM global_slots WHERE id = ?', [id]);
    res.status(200).json({ message: 'Global Lucky Slot deleted successfully.' });
  } catch (err) {
    console.error('❌ Error deleting global slot:', err);
    res.status(500).json({ message: 'Server error while deleting global slot.' });
  }
});

app.use('/uploads', express.static('uploads'));

app.post('/api/create-poker-site', upload.single('logo'), async (req, res) => {
  const { name, description, rating, link } = req.body;
  const logo = req.file ? `/uploads/${req.file.filename}` : null;

  if (!name || !description || !rating || !link || !logo) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    await db.promise().query(
      'INSERT INTO poker_sites (name, description, rating, link, logo) VALUES (?, ?, ?, ?, ?)',
      [name, description, rating, link, logo]
    );
    res.status(201).json({ message: 'Poker site added successfully!' });
  } catch (err) {
    console.error('Error adding poker site:', err);
    res.status(500).json({ message: 'Server error while adding poker site.' });
  }
});

app.get('/api/poker-sites', async (req, res) => {
  try {
    const [rows] = await db.promise().query('SELECT * FROM poker_sites ORDER BY rating DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch poker sites' });
  }
});
app.post('/api/update-poker-site/:id', upload.single('logo'), async (req, res) => {
  const { id } = req.params;
  const { name, description, rating, link } = req.body;
  const logo = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const [existing] = await db.promise().query('SELECT * FROM poker_sites WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Poker site not found.' });
    }

    const updateQuery = logo
      ? 'UPDATE poker_sites SET name = ?, description = ?, rating = ?, link = ?, logo = ? WHERE id = ?'
      : 'UPDATE poker_sites SET name = ?, description = ?, rating = ?, link = ? WHERE id = ?';

    const values = logo
      ? [name, description, rating, link, logo, id]
      : [name, description, rating, link, id];

    await db.promise().query(updateQuery, values);
    res.status(200).json({ message: 'Poker site updated successfully!' });
  } catch (err) {
    console.error('Error updating poker site:', err);
    res.status(500).json({ message: 'Server error during poker site update.' });
  }
});
app.delete('/api/delete-poker-site/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ message: 'Poker site ID is required.' });

  try {
    const [rows] = await db.promise().query('SELECT * FROM poker_sites WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Poker site not found.' });
    }

    // Optional: delete the logo file
    const logoPath = rows[0].logo;
    if (logoPath) {
      const fs = require('fs');
      const path = `.${logoPath}`; // e.g. "./uploads/..."
      if (fs.existsSync(path)) fs.unlinkSync(path);
    }

    await db.promise().query('DELETE FROM poker_sites WHERE id = ?', [id]);
    res.status(200).json({ message: 'Poker site deleted successfully.' });
  } catch (err) {
    console.error('Error deleting poker site:', err);
    res.status(500).json({ message: 'Server error while deleting poker site.' });
  }
});

app.post('/api/add-casino-card', upload.single('image'), async (req, res) => {
  const { name, safetyIndex, features, bonus, termsLink, visitLink, reviewLink, rank } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : null;

  if (!name || !safetyIndex || !features || !bonus || !image || !visitLink || !reviewLink) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    await db.promise().query(
      `INSERT INTO casino_cards (name, safety_index, features, bonus, terms_link, visit_link, review_link, image, rank)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, safetyIndex, features, bonus, termsLink, visitLink, reviewLink, image, rank]
    );
    res.status(201).json({ message: 'Casino card added successfully!' });
  } catch (err) {
    console.error('❌ Failed to add casino card:', err);
    res.status(500).json({ message: 'Server error while adding casino card.' });
  }
});
app.get('/api/casino-cards', async (req, res) => {
  try {
    const [rows] = await db.promise().query('SELECT * FROM casino_cards ORDER BY rank ASC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching casino cards:', error);
    res.status(500).json({ message: 'Server error while fetching casino cards.' });
  }
});

// Update Casino Card
app.post('/api/update-casino-card/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { name, bonus, visit_link, review_link, terms_link, features, rank, safety_index } = req.body;

  const image = req.file ? `/uploads/${req.file.filename}` : null;

  try {
const query = image
  ? 'UPDATE casino_cards SET name=?, bonus=?, visit_link=?, review_link=?, terms_link=?, features=?, rank=?, safety_index=?, image=? WHERE id=?'
  : 'UPDATE casino_cards SET name=?, bonus=?, visit_link=?, review_link=?, terms_link=?, features=?, rank=?, safety_index=? WHERE id=?';

const values = image
  ? [name, bonus, visit_link, review_link, terms_link, features, rank, safety_index, image, id]
  : [name, bonus, visit_link, review_link, terms_link, features, rank, safety_index, id];


    await db.promise().query(query, values);
    res.status(200).json({ message: 'Casino card updated successfully!' });
  } catch (err) {
    console.error('Error updating casino card:', err);
    res.status(500).json({ message: 'Error updating casino card.' });
  }
});


// Delete Casino Card
app.delete('/api/delete-casino-card/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.promise().query('DELETE FROM casino_cards WHERE id = ?', [id]);
    res.status(200).json({ message: 'Casino card deleted successfully.' });
  } catch (err) {
    console.error('Error deleting casino card:', err);
    res.status(500).json({ message: 'Error deleting casino card.' });
  }
});

app.post('/api/best-casino', upload.single('logo'), async (req, res) => {
  const { promo, code, min_deposit, wagering, rating, link } = req.body;
  const logo = req.file ? `/uploads/${req.file.filename}` : null;

  if (!promo || !code || !min_deposit || !wagering || !rating || !link || !logo) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    await db.promise().query(
      'INSERT INTO best_casinos (promo, code, min_deposit, wagering, rating, link, logo) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [promo, code, min_deposit, wagering, rating, link, logo]
    );
    res.status(201).json({ message: 'Best Casino card added!' });
  } catch (err) {
    console.error("Error saving best casino:", err);
    res.status(500).json({ message: 'Server error while saving card.' });
  }
});

app.get('/api/best-casino', async (req, res) => {
  try {
    const [rows] = await db.promise().query('SELECT * FROM best_casinos ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error("Error fetching best casinos:", err);
    res.status(500).json({ message: 'Error fetching best casinos' });
  }
});
// UPDATE Best Casino
app.post('/api/update-best-casino/:id', upload.single('logo'), async (req, res) => {
  const { id } = req.params;
  const { promo, code, min_deposit, wagering, rating, link } = req.body;
  const logo = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const [existing] = await db.promise().query('SELECT * FROM best_casinos WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ message: 'Not found.' });

    const query = logo
      ? 'UPDATE best_casinos SET promo=?, code=?, min_deposit=?, wagering=?, rating=?, link=?, logo=? WHERE id=?'
      : 'UPDATE best_casinos SET promo=?, code=?, min_deposit=?, wagering=?, rating=?, link=? WHERE id=?';

    const values = logo
      ? [promo, code, min_deposit, wagering, rating, link, logo, id]
      : [promo, code, min_deposit, wagering, rating, link, id];

    await db.promise().query(query, values);
    res.status(200).json({ message: 'Best Casino updated successfully!' });
  } catch (err) {
    console.error("Error updating best casino:", err);
    res.status(500).json({ message: 'Server error while updating.' });
  }
});

// DELETE Best Casino
app.delete('/api/delete-best-casino/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.promise().query('SELECT * FROM best_casinos WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Not found.' });

    const fs = require('fs');
    const path = `.${rows[0].logo}`;
    if (fs.existsSync(path)) fs.unlinkSync(path);

    await db.promise().query('DELETE FROM best_casinos WHERE id = ?', [id]);
    res.status(200).json({ message: 'Best Casino deleted successfully.' });
  } catch (err) {
    console.error('Error deleting best casino:', err);
    res.status(500).json({ message: 'Server error while deleting.' });
  }
});



// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

app.post('/api/create-casino', upload.single('logo'), async (req, res) => {
  console.log("🚀 Creating new casino:", req.body);
  const { label1, label2, country, website, ranking } = req.body;

  if (!label1 || !label2 || !country || !website || !ranking) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  const payments = Array.isArray(req.body['payments[]'])
    ? req.body['payments[]']
    : [req.body['payments[]']];

  const logo = req.file ? `/uploads/${req.file.filename}` : null;

  if (!logo) {
    return res.status(400).json({ message: 'Logo upload is required.' });
  }

  try {
    await db.promise().query(
      'INSERT INTO casinos (label1, label2, country, website, logo, payments, ranking) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [label1, label2, country, website, logo, JSON.stringify(payments), ranking]
    );

    res.status(201).json({ message: 'New casino created successfully!' });
  } catch (error) {
    console.error('Error creating casino:', error);
    res.status(500).json({ message: 'Server error while creating casino.' });
  }
});


app.delete('/api/delete-casino/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ message: "Casino ID is required." });

  try {
    const [check] = await db.promise().query('SELECT * FROM casinos WHERE id = ?', [id]);
    if (check.length === 0) {
      return res.status(404).json({ message: 'Casino not found.' });
    }

    await db.promise().query('DELETE FROM casinos WHERE id = ?', [id]);
    res.status(200).json({ message: 'Casino deleted successfully.' });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ message: "Server error while deleting casino." });
  }
});
app.delete('/api/delete-post/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) return res.status(400).json({ message: 'Post ID is required.' });

  try {
    const [rows] = await db.promise().query('SELECT * FROM posts WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Post not found.' });
    }

    // Optional: Delete image file from /uploads/ if needed
    const imagePath = rows[0].image;
    if (imagePath) {
      const fs = require('fs');
      const path = `.${imagePath}`; // assumes "/uploads/xyz.png"
      if (fs.existsSync(path)) {
        fs.unlinkSync(path);
      }
    }

    await db.promise().query('DELETE FROM posts WHERE id = ?', [id]);
    res.status(200).json({ message: 'News post deleted successfully.' });
  } catch (err) {
    console.error('❌ Error deleting post:', err);
    res.status(500).json({ message: 'Server error while deleting post.' });
  }
});

app.post('/api/update-post/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { title, content, link, category } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const [existing] = await db.promise().query('SELECT * FROM posts WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ message: 'Post not found.' });

  const updateQuery = image
  ? 'UPDATE posts SET title = ?, content = ?, link = ?, image = ?, category = ? WHERE id = ?'
  : 'UPDATE posts SET title = ?, content = ?, link = ?, category = ? WHERE id = ?';

const values = image
  ? [title, content, link, image, category, id]
  : [title, content, link, category, id];


    await db.promise().query(updateQuery, values);

    res.status(200).json({ message: 'News post updated successfully!' });
  } catch (err) {
    console.error('Update post error:', err);
    res.status(500).json({ message: 'Server error during post update.' });
  }
});
