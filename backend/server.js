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

// Define Task Schema
const taskSchema = new mongoose.Schema({
    collector: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    userId: String,
    description: String,
    status: String // 'pending', 'approved', 'completed'
});

// Define User Schema
const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    role: String,
    tasks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task'
    }]
});

// Define Feedback Schema
const feedbackSchema = new mongoose.Schema({
    name: String,
    email: String,
    message: String,
});

const User = mongoose.model('User', userSchema);
const Task = mongoose.model('Task', taskSchema);
const Feedback = mongoose.model('Feedback', feedbackSchema);

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
        res.json({ message: 'Registration successful!', redirect: '/login.html' });
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
            res.json({ message: 'Login successful!', redirect: redirectUrl, userId: user._id });
        } else {
            res.status(401).json({ message: 'Invalid email or password!' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Login failed!', error });
    }
});

// Route to handle collection requests
app.post('/requests', async (req, res) => {
    const { userId, collectorId, description, status } = req.body;

    try {
        // Find the user and assigned collector
        const user = await User.findById(userId);
        const collector = await User.findById(collectorId);

        if (!user || !collector) {
            return res.status(404).json({ success: false, message: 'User or collector not found.' });
        }

        // Create a new task with assigned collector
        const task = new Task({ userId, collector: collector._id, description, status });
        await task.save();

        // Update user's tasks array
        user.tasks.push(task);
        await user.save();

        // Update collector's tasks array
        collector.tasks.push(task);
        await collector.save();

        res.json({ success: true, message: 'Request submitted successfully!', task });
    } catch (error) {
        console.error('Error submitting request:', error);
        res.status(500).json({ success: false, message: 'Failed to submit request!', error });
    }
});

// Route to get dashboard data for a specific collector
app.get('/collector/:id/dashboard', async (req, res) => {
    const { id } = req.params;

    try {
        // Find the collector by ID and populate tasks
        const user = await User.findById(id).populate({
            path: 'tasks',
            populate: {
                path: 'collector',
                select: 'username'
            }
        });

        if (!user) {
            return res.status(404).json({ message: 'Collector not found!' });
        }

        // Filter tasks based on status
        const pendingTasks = user.tasks.filter(task => task.status === 'pending');
        const approvedTasks = user.tasks.filter(task => task.status === 'approved');
        const completedTasks = user.tasks.filter(task => task.status === 'completed');

        res.json({
            pendingTasks,
            approvedTasks,
            completedTasks,
            totalCollections: completedTasks.length
        });
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ message: 'Error fetching dashboard data', error });
    }
});

// Route to get all collectors
app.get('/collectors', async (req, res) => {
    try {
        const collectors = await User.find({ role: 'collector' }, '_id username');
        res.json(collectors);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch collectors!', error });
    }
});

// Route to get all pending requests
app.get('/requests/pending', async (req, res) => {
    try {
        const requests = await Task.find({ status: 'pending' }).populate('collector', 'username');
        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch pending requests!', error });
    }
});

// Route to approve a request by ID
app.put('/requests/:id/approve', async (req, res) => {
    const { id } = req.params;
    try {
        const updatedRequest = await Task.findByIdAndUpdate(id, { status: 'approved' }, { new: true });
        if (!updatedRequest) {
            return res.status(404).json({ message: 'Request not found!' });
        }
        res.json({ success: true, updatedRequest });
    } catch (error) {
        res.status(500).json({ message: 'Failed to approve request!', error });
    }
});

// Route to complete a request by ID
app.put('/requests/:id/complete', async (req, res) => {
    const { id } = req.params;
    try {
        const updatedRequest = await Task.findByIdAndUpdate(id, { status: 'completed' }, { new: true });
        if (!updatedRequest) {
            return res.status(404).json({ message: 'Request not found!' });
        }
        res.json({ success: true, updatedRequest });
    } catch (error) {
        res.status(500).json({ message: 'Failed to complete request!', error });
    }
});

// Route to get all feedback
app.get('/feedbacks', async (req, res) => {
    try {
        const feedbacks = await Feedback.find();
        res.json(feedbacks);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch feedback!', error });
    }
});

// Route to submit feedback
app.post('/feedback', async (req, res) => {
    const { name, email, message } = req.body;

    try {
        const feedback = new Feedback({ name, email, message });
        await feedback.save();
        res.json({ message: 'Feedback submitted successfully!' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to submit feedback!', error });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
