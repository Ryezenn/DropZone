const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const Project = require('../models/Project');
const User = require('../models/User');

// Setup upload directory
const uploadDir = process.env.NODE_ENV === 'production'
  ? path.join('/tmp', 'uploads')
  : path.join(__dirname, '../uploads');

try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (err) {
  console.warn('Warning: Could not create upload directory:', err.message);
}


// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File type validation whitelist
const allowedExtensions = [
  '.zip', '.rar', '.7z', '.tar', '.gz', 
  '.pdf', '.png', '.jpg', '.jpeg', '.webp', '.svg',
  '.txt', '.json', '.js', '.css', '.html', '.md',
  '.py', '.cpp', '.java', '.go', '.ts'
];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    return cb(new Error(`File type not allowed. Allowed types: ${allowedExtensions.join(', ')}`), false);
  }
  cb(null, true);
};

const maxFileSize = parseInt(process.env.MAX_FILE_SIZE, 10) || 52428800; // default 50MB

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: maxFileSize }
});

// Apply auth middleware to all user projects routes
router.use(auth);

// Helper function to split comma separated strings into trimmed arrays
const parseTags = (tagsInput) => {
  if (!tagsInput) return [];
  if (Array.isArray(tagsInput)) return tagsInput.map(t => t.trim()).filter(Boolean);
  return tagsInput.split(',').map(t => t.trim()).filter(Boolean);
};

// GET /api/user/projects - Get own projects
router.get('/', async (req, res) => {
  try {
    const projects = await Project.find({ owner: req.user.id }).sort({ createdAt: -1 });
    return res.json(projects);
  } catch (error) {
    console.error('Error fetching user projects:', error);
    return res.status(500).json({ message: 'Server error fetching your projects.' });
  }
});

// POST /api/user/projects/website - Upload website project
router.post('/website', async (req, res) => {
  try {
    const { title, description, websiteUrl, previewImage, techStack, tags } = req.body;

    if (!title || !description || !websiteUrl) {
      return res.status(400).json({ message: 'Title, description, and Website URL are required.' });
    }

    if (title.length > 80) {
      return res.status(400).json({ message: 'Title cannot exceed 80 characters.' });
    }

    if (description.length > 500) {
      return res.status(400).json({ message: 'Description cannot exceed 500 characters.' });
    }

    const newProject = new Project({
      title,
      description,
      type: 'website',
      owner: req.user.id,
      ownerUsername: req.user.username,
      websiteUrl,
      previewImage: previewImage || '',
      techStack: parseTags(techStack),
      tags: parseTags(tags),
      featured: false, // User cannot feature their own projects directly
      status: 'published'
    });

    await newProject.save();

    // Increment user project count
    await User.findByIdAndUpdate(req.user.id, { $inc: { projectCount: 1 } });

    return res.status(201).json(newProject);
  } catch (error) {
    console.error('Error creating website project:', error);
    return res.status(500).json({ message: 'Server error creating website project.' });
  }
});

// POST /api/user/projects/file - Upload file project
router.post('/file', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      console.error('Multer upload error:', err);
      return res.status(400).json({ message: err.message || 'File upload failed.' });
    }

    try {
      const { title, description, tags } = req.body;

      if (!title || !description) {
        // Delete uploaded file if form validation fails
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({ message: 'Title and description are required.' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'A project file must be uploaded.' });
      }

      if (title.length > 80) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: 'Title cannot exceed 80 characters.' });
      }

      if (description.length > 500) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: 'Description cannot exceed 500 characters.' });
      }

      const newProject = new Project({
        title,
        description,
        type: 'file',
        owner: req.user.id,
        ownerUsername: req.user.username,
        fileName: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        fileType: path.extname(req.file.originalname).substring(1),
        tags: parseTags(tags),
        featured: false,
        status: 'published'
      });

      await newProject.save();

      // Increment user project count
      await User.findByIdAndUpdate(req.user.id, { $inc: { projectCount: 1 } });

      return res.status(201).json(newProject);
    } catch (error) {
      console.error('Error creating file project:', error);
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(500).json({ message: 'Server error creating file project.' });
    }
  });
});

// PUT /api/user/projects/:id - Edit project
router.put('/:id', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      console.error('Multer upload error on edit:', err);
      return res.status(400).json({ message: err.message || 'File upload failed.' });
    }

    try {
      const project = await Project.findById(req.params.id);
      if (!project) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(404).json({ message: 'Project not found.' });
      }

      // Ownership check
      if (project.owner.toString() !== req.user.id) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(403).json({ message: 'Forbidden. You do not own this project.' });
      }

      const { title, description, tags, websiteUrl, previewImage, techStack } = req.body;

      if (title) {
        if (title.length > 80) {
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(400).json({ message: 'Title cannot exceed 80 characters.' });
        }
        project.title = title;
      }

      if (description) {
        if (description.length > 500) {
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(400).json({ message: 'Description cannot exceed 500 characters.' });
        }
        project.description = description;
      }

      if (tags !== undefined) {
        project.tags = parseTags(tags);
      }

      if (project.type === 'website') {
        if (websiteUrl) project.websiteUrl = websiteUrl;
        if (previewImage !== undefined) project.previewImage = previewImage;
        if (techStack !== undefined) project.techStack = parseTags(techStack);
      } else if (project.type === 'file') {
        if (req.file) {
          // Delete old file from disk
          if (project.filePath && fs.existsSync(project.filePath)) {
            fs.unlinkSync(project.filePath);
          }
          // Update project with new file info
          project.fileName = req.file.originalname;
          project.filePath = req.file.path;
          project.fileSize = req.file.size;
          project.fileType = path.extname(req.file.originalname).substring(1);
        }
      }

      await project.save();
      return res.json(project);
    } catch (error) {
      console.error('Error updating project:', error);
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(500).json({ message: 'Server error updating project.' });
    }
  });
});

// DELETE /api/user/projects/:id - Delete project
router.delete('/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    // Ownership check
    if (project.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden. You do not own this project.' });
    }

    // Delete file from disk if type is file
    if (project.type === 'file' && project.filePath && fs.existsSync(project.filePath)) {
      fs.unlinkSync(project.filePath);
    }

    await Project.deleteOne({ _id: project._id });

    // Decrement user project count
    await User.findByIdAndUpdate(req.user.id, { $inc: { projectCount: -1 } });

    return res.json({ message: 'Project deleted successfully.' });
  } catch (error) {
    console.error('Error deleting project:', error);
    return res.status(500).json({ message: 'Server error deleting project.' });
  }
});

module.exports = router;
