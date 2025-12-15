const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const logger = require('./logs/mcpLog');
const {LASERTAGS_PROJECT_PATH} = require('./env.json');

const _logger = logger();

const execAsync = promisify(exec);
const projectPath = LASERTAGS_PROJECT_PATH;

// Helper function to safely read JSON files
async function readJsonFile(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        _logger.warn(`Failed to read JSON file ${filePath}:`, error.message);
        return null;
    }
}

// Helper function to check if path exists
async function pathExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

// Helper function to get git status
async function getGitStatus(projectPath) {
    try {
        const { stdout } = await execAsync('git status --porcelain', { cwd: projectPath });
        const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath });
        const { stdout: lastCommit } = await execAsync('git log -1 --format=%H|%s|%an|%ad --date=iso', { cwd: projectPath });
        const [hash, message, author, date] = lastCommit.trim().split('|');
        
        return {
            branch: branch.trim(),
            lastCommit: {
                hash: hash,
                message: message,
                author: author,
                date: date
            },
            changes: stdout.trim().split('\n').filter(line => line).map(line => {
                const status = line.substring(0, 2);
                const file = line.substring(3);
                return { status, file };
            })
        };
    } catch (error) {
        _logger.warn('Git status check failed:', error.message);
        return { error: 'Not a git repository or git not available' };
    }
}

// Helper function to get directory structure
async function getDirectoryStructure(dirPath, maxDepth = 2, currentDepth = 0) {
    if (currentDepth >= maxDepth) {
        return null;
    }
    
    try {
        const items = await fs.readdir(dirPath, { withFileTypes: true });
        const structure = {};
        
        for (const item of items) {
            // Skip node_modules, .git, and other common ignore directories
            if (item.name.startsWith('.') && item.name !== '.gitignore' && item.name !== '.env.example') {
                continue;
            }
            if (item.name === 'node_modules' || item.name === 'dist' || item.name === 'build') {
                continue;
            }
            
            const fullPath = path.join(dirPath, item.name);
            
            if (item.isDirectory()) {
                structure[item.name] = {
                    type: 'directory',
                    children: await getDirectoryStructure(fullPath, maxDepth, currentDepth + 1)
                };
            } else {
                try {
                    const stats = await fs.stat(fullPath);
                    structure[item.name] = {
                        type: 'file',
                        size: stats.size,
                        modified: stats.mtime.toISOString()
                    };
                } catch (err) {
                    structure[item.name] = { type: 'file', error: 'Unable to read' };
                }
            }
        }
        
        return structure;
    } catch (error) {
        _logger.warn(`Failed to read directory ${dirPath}:`, error.message);
        return { error: error.message };
    }
}

// Health check endpoint
router.get('/api/health', async (req, res) => {
    try {
        const projectExists = await pathExists(projectPath);
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            projectPath: projectPath,
            projectExists: projectExists
        });
    } catch (error) {
        _logger.error('Health check failed:', error);
        res.status(500).json({ status: 'unhealthy', error: error.message });
    }
});

// Get project information
router.get('/api/project/info', async (req, res) => {
    try {
        const packageJsonPath = path.join(projectPath, 'package.json');
        const readmePath = path.join(projectPath, 'README.md');
        
        const packageJson = await readJsonFile(packageJsonPath);
        let readme = null;
        
        try {
            readme = await fs.readFile(readmePath, 'utf8');
        } catch (error) {
            _logger.warn('README not found');
        }
        
        const projectExists = await pathExists(projectPath);
        
        res.json({
            projectPath: projectPath,
            exists: projectExists,
            packageJson: packageJson,
            readme: readme ? readme.substring(0, 500) : null, // First 500 chars
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        _logger.error('Failed to get project info:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get project status (git, recent changes)
router.get('/api/project/status', async (req, res) => {
    try {
        const projectExists = await pathExists(projectPath);
        if (!projectExists) {
            return res.status(404).json({ error: 'Project path does not exist' });
        }
        
        const gitStatus = await getGitStatus(projectPath);
        
        // Get package.json info
        const packageJsonPath = path.join(projectPath, 'package.json');
        const packageJson = await readJsonFile(packageJsonPath);
        
        // Check for common files
        const commonFiles = ['package.json', 'README.md', '.gitignore', 'Dockerfile'];
        const fileStatus = {};
        
        for (const file of commonFiles) {
            const filePath = path.join(projectPath, file);
            fileStatus[file] = await pathExists(filePath);
        }
        
        res.json({
            projectPath: projectPath,
            git: gitStatus,
            packageJson: packageJson ? {
                name: packageJson.name,
                version: packageJson.version,
                dependencies: Object.keys(packageJson.dependencies || {}).length,
                devDependencies: Object.keys(packageJson.devDependencies || {}).length
            } : null,
            files: fileStatus,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        _logger.error('Failed to get project status:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get project structure
router.get('/api/project/structure', async (req, res) => {
    try {
        const projectExists = await pathExists(projectPath);
        if (!projectExists) {
            return res.status(404).json({ error: 'Project path does not exist' });
        }
        
        const maxDepth = parseInt(req.query.depth) || 2;
        const structure = await getDirectoryStructure(projectPath, maxDepth);
        
        res.json({
            projectPath: projectPath,
            structure: structure,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        _logger.error('Failed to get project structure:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get specific file content
router.get('/api/project/file', async (req, res) => {
    try {
        const { file } = req.query;
        if (!file) {
            return res.status(400).json({ error: 'File parameter is required' });
        }
        
        // Security: prevent path traversal
        if (file.includes('..') || path.isAbsolute(file)) {
            return res.status(400).json({ error: 'Invalid file path' });
        }
        
        const filePath = path.join(projectPath, file);
        const exists = await pathExists(filePath);
        
        if (!exists) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        const stats = await fs.stat(filePath);
        if (!stats.isFile()) {
            return res.status(400).json({ error: 'Path is not a file' });
        }
        
        // Limit file size to 1MB
        if (stats.size > 1024 * 1024) {
            return res.status(400).json({ error: 'File too large (max 1MB)' });
        }
        
        const content = await fs.readFile(filePath, 'utf8');
        
        res.json({
            file: file,
            path: filePath,
            size: stats.size,
            modified: stats.mtime.toISOString(),
            content: content
        });
    } catch (error) {
        _logger.error('Failed to read file:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get dependencies information
router.get('/api/project/dependencies', async (req, res) => {
    try {
        const packageJsonPath = path.join(projectPath, 'package.json');
        const packageJson = await readJsonFile(packageJsonPath);
        
        if (!packageJson) {
            return res.status(404).json({ error: 'package.json not found' });
        }
        
        res.json({
            name: packageJson.name,
            version: packageJson.version,
            dependencies: packageJson.dependencies || {},
            devDependencies: packageJson.devDependencies || {},
            scripts: packageJson.scripts || {},
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        _logger.error('Failed to get dependencies:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get recent changes (git log)
router.get('/api/project/changes', async (req, res) => {
    try {
        const projectExists = await pathExists(projectPath);
        if (!projectExists) {
            return res.status(404).json({ error: 'Project path does not exist' });
        }
        
        const limit = parseInt(req.query.limit) || 10;
        const { stdout } = await execAsync(
            `git log -${limit} --format=%H|%s|%an|%ad --date=iso`,
            { cwd: projectPath }
        );
        
        const commits = stdout.trim().split('\n').filter(line => line).map(line => {
            const [hash, message, author, date] = line.split('|');
            return { hash, message, author, date };
        });
        
        res.json({
            commits: commits,
            count: commits.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        _logger.warn('Failed to get git changes:', error.message);
        res.json({
            commits: [],
            count: 0,
            error: 'Git not available or not a git repository',
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;

