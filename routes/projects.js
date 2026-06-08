const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const Project = require('../models/Project');
const User = require('../models/User');

// GET /api/projects - Public query (search, sort, type, username)
router.get('/', async (req, res) => {
  try {
    const { type, search, sort, username } = req.query;
    let query = { status: 'published' };

    // Filter by type
    if (type && type !== 'all') {
      query.type = type;
    }

    // Filter by username
    if (username) {
      query.ownerUsername = { $regex: new RegExp(`^${username}$`, 'i') };
    }

    // Search filter
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    let sortOptions = {};
    if (sort === 'downloads') {
      sortOptions = { downloadCount: -1, createdAt: -1 };
    } else if (sort === 'featured') {
      // Sort featured first, then latest
      sortOptions = { featured: -1, createdAt: -1 };
    } else {
      // Default: latest
      sortOptions = { createdAt: -1 };
    }

    const projects = await Project.find(query)
      .sort(sortOptions)
      .populate('owner', 'username email avatar bio joinedAt');

    return res.json(projects);
  } catch (error) {
    console.error('Error fetching public projects:', error);
    return res.status(500).json({ message: 'Server error fetching projects.' });
  }
});

// GET /api/projects/stats - Public aggregate statistics
router.get('/stats', async (req, res) => {
  try {
    const totalProjects = await Project.countDocuments({ status: 'published' });
    const totalUsers = await User.countDocuments();
    
    // Sum of downloads
    const downloadStats = await Project.aggregate([
      { $group: { _id: null, total: { $sum: "$downloadCount" } } }
    ]);
    const totalDownloads = downloadStats.length > 0 ? downloadStats[0].total : 0;

    return res.json({
      totalProjects,
      totalUsers,
      totalDownloads
    });
  } catch (error) {
    console.error('Error generating public stats:', error);
    return res.status(500).json({ message: 'Server error generating public stats.' });
  }
});

// GET /api/projects/:id - Public details
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner', 'username email avatar bio joinedAt');
    
    if (!project || project.status !== 'published') {
      return res.status(404).json({ message: 'Project not found.' });
    }

    return res.json(project);
  } catch (error) {
    console.error('Error fetching project detail:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid project ID.' });
    }
    return res.status(500).json({ message: 'Server error fetching project details.' });
  }
});

// GET /api/projects/:id/download - File download + atomic increment
router.get('/:id/download', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    if (project.type !== 'file') {
      return res.status(400).json({ message: 'This project is not a downloadable file.' });
    }

    // Verify physical file existence
    if (!project.filePath || !fs.existsSync(project.filePath)) {
      return res.status(404).json({ message: 'Physical file not found on server.' });
    }

    // Atomic increment download count
    await Project.findByIdAndUpdate(
      req.params.id,
      { $inc: { downloadCount: 1 } },
      { new: true }
    );

    // Trigger download
    return res.download(project.filePath, project.fileName, (err) => {
      if (err) {
        console.error('File download delivery failed:', err);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Error delivering file.' });
        }
      }
    });
  } catch (error) {
    console.error('Error during file download:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid project ID.' });
    }
    return res.status(500).json({ message: 'Server error preparing file download.' });
  }
});

module.exports = router;
