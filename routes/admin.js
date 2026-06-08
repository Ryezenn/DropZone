const express = require('express');
const router = express.Router();
const fs = require('fs');
const adminAuth = require('../middleware/adminAuth');
const Project = require('../models/Project');
const User = require('../models/User');

// Apply adminAuth middleware to all admin routes
router.use(adminAuth);

// GET /api/admin/projects - Get all projects
router.get('/projects', async (req, res) => {
  try {
    const projects = await Project.find()
      .sort({ createdAt: -1 })
      .populate('owner', 'username email joinedAt');
    return res.json(projects);
  } catch (error) {
    console.error('Admin fetch projects error:', error);
    return res.status(500).json({ message: 'Server error fetching all projects.' });
  }
});

// PATCH /api/admin/projects/:id/featured - Toggle featured status
router.patch('/projects/:id/featured', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    project.featured = !project.featured;
    await project.save();

    return res.json({ message: `Project featured status updated.`, project });
  } catch (error) {
    console.error('Admin toggle featured error:', error);
    return res.status(500).json({ message: 'Server error toggling featured status.' });
  }
});

// DELETE /api/admin/projects/:id - Admin delete any project
router.delete('/projects/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    // Delete file if type is file
    if (project.type === 'file' && project.filePath && fs.existsSync(project.filePath)) {
      fs.unlinkSync(project.filePath);
    }

    // Decrement user projectCount
    await User.findByIdAndUpdate(project.owner, { $inc: { projectCount: -1 } });

    await Project.deleteOne({ _id: project._id });

    return res.json({ message: 'Project deleted successfully by admin.' });
  } catch (error) {
    console.error('Admin delete project error:', error);
    return res.status(500).json({ message: 'Server error deleting project.' });
  }
});

// GET /api/admin/users - Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ joinedAt: -1 });
    return res.json(users);
  } catch (error) {
    console.error('Admin fetch users error:', error);
    return res.status(500).json({ message: 'Server error fetching users.' });
  }
});

// DELETE /api/admin/users/:id - Delete user and cascade delete everything
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Find all projects of this user
    const projects = await Project.find({ owner: userId });

    // Delete physical files
    for (const project of projects) {
      if (project.type === 'file' && project.filePath && fs.existsSync(project.filePath)) {
        try {
          fs.unlinkSync(project.filePath);
        } catch (err) {
          console.error(`Error deleting physical file at ${project.filePath}:`, err);
        }
      }
    }

    // Delete projects in db
    await Project.deleteMany({ owner: userId });

    // Delete user in db
    await User.deleteOne({ _id: userId });

    return res.json({ message: 'User and all associated projects & files deleted successfully.' });
  } catch (error) {
    console.error('Admin delete user error:', error);
    return res.status(500).json({ message: 'Server error deleting user.' });
  }
});

// GET /api/admin/stats - Statistics summary + last 7 days upload count
router.get('/stats', async (req, res) => {
  try {
    const totalProjects = await Project.countDocuments();
    const totalUsers = await User.countDocuments();

    // Sum of downloads
    const downloadStats = await Project.aggregate([
      { $group: { _id: null, total: { $sum: "$downloadCount" } } }
    ]);
    const totalDownloads = downloadStats.length > 0 ? downloadStats[0].total : 0;

    // Sum of files size
    const sizeStats = await Project.aggregate([
      { $match: { type: 'file' } },
      { $group: { _id: null, total: { $sum: "$fileSize" } } }
    ]);
    const totalFilesSize = sizeStats.length > 0 ? sizeStats[0].total : 0;

    // Simple upload activity last 7 days (dates formatted as YYYY-MM-DD)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const uploadsAggregation = await Project.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Build map from aggregation result
    const uploadMap = {};
    uploadsAggregation.forEach(item => {
      uploadMap[item._id] = item.count;
    });

    // Populate all 7 days with counts (defaulting to 0)
    const uploadHistory = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - 6 + i);
      const dateString = date.toISOString().split('T')[0];
      uploadHistory.push({
        date: dateString,
        label: date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
        count: uploadMap[dateString] || 0
      });
    }

    return res.json({
      totalProjects,
      totalUsers,
      totalDownloads,
      totalFilesSize,
      uploadHistory
    });
  } catch (error) {
    console.error('Error generating admin stats:', error);
    return res.status(500).json({ message: 'Server error generating statistics.' });
  }
});

module.exports = router;
