const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(cors());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/registrationDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// Define User Schema
const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    role: String
});

const User = mongoose.model('User', userSchema);

// Routes
// Get all users
app.get('/users', async (req, res) => {
    try {
        const users = await User.find();
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch users!', error });
    }
});

// Delete a user by ID
app.delete('/users/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await User.findByIdAndDelete(id);
        res.json({ message: 'User deleted successfully!' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete user!', error });
    }
});

// Handle registration
app.post('/register', async (req, res) => {
    const { username, email, password, role } = req.body;

    try {
        const user = new User({ username, email, password, role });
        await user.save();
        res.json({ message: 'Registration successful!', redirect: '/login.html' }); // Redirect URL added
    } catch (error) {
        res.status(500).json({ message: 'Registration failed!', error });
    }
});

// Handle login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email, password });
        if (user) {
            let redirectUrl;
            if (user.role === 'admin') {
                redirectUrl = '/admin-dashboard.html';
            } else if (user.role === 'producer') {
                redirectUrl = '/producer-dashboard.html';
            } else {
                redirectUrl = '/collector-dashboard.html'; // Default dashboard for other roles
            }
            res.json({ message: 'Login successful!', redirect: redirectUrl });
        } else {
            res.status(401).json({ message: 'Invalid email or password!' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Login failed!', error });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
