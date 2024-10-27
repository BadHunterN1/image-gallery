const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const app = express();

// Enable CORS for development
app.use((req, res, next) => {
	res.header("Access-Control-Allow-Origin", "*");
	res.header(
		"Access-Control-Allow-Headers",
		"Origin, X-Requested-With, Content-Type, Accept"
	);
	next();
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, "../public")));

// Function to get file stats with error handling
async function getFileStats(fullPath) {
	try {
		const stats = await fs.stat(fullPath);
		return {
			// Convert to ISO string for consistent timezone handling
			lastModified: stats.mtime.toISOString(),
			size: stats.size,
		};
	} catch (error) {
		console.warn(`Error getting stats for ${fullPath}:`, error);
		return {
			lastModified: new Date().toISOString(),
			size: 0,
		};
	}
}

// Function to recursively get folder structure
async function getFolderStructure(dirPath, baseDir) {
	try {
		const items = await fs.readdir(dirPath, { withFileTypes: true });
		const structure = {
			folders: [],
			images: [],
		};

		baseDir = baseDir || dirPath;

		for (const item of items) {
			const fullPath = path.join(dirPath, item.name);
			// Calculate path relative to the public directory for URLs
			const relativePath = path.relative(baseDir, fullPath);

			if (item.isDirectory()) {
				const folderStats = await getFileStats(fullPath);
				structure.folders.push({
					name: item.name,
					type: "folder",
					path: relativePath.replace(/\\/g, "/"),
					lastModified: folderStats.lastModified,
					content: await getFolderStructure(fullPath, baseDir),
				});
			} else if (isImageFile(item.name)) {
				const fileStats = await getFileStats(fullPath);
				structure.images.push({
					name: item.name,
					type: "image",
					path: relativePath.replace(/\\/g, "/"),
					lastModified: fileStats.lastModified,
					size: fileStats.size,
				});
			}
		}

		// Sort folders and images by lastModified date
		structure.folders.sort(
			(a, b) => new Date(b.lastModified) - new Date(a.lastModified)
		);
		structure.images.sort(
			(a, b) => new Date(b.lastModified) - new Date(a.lastModified)
		);

		return structure;
	} catch (error) {
		console.error("Error reading directory:", error);
		return { folders: [], images: [] };
	}
}

// Helper function to check if file is an image
function isImageFile(filename) {
	const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
	return imageExtensions.some((ext) => filename.toLowerCase().endsWith(ext));
}

// API endpoint to get folder structure
app.get("/api/folder-structure", async (req, res) => {
	try {
		const publicImgsPath = path.join(__dirname, "../public/imgs");

		// Ensure the directory exists
		try {
			await fs.access(publicImgsPath);
		} catch (error) {
			console.error("Images directory not found:", error);
			return res.json({ folders: [], images: [] });
		}

		const structure = await getFolderStructure(publicImgsPath, publicImgsPath);

		// Add server timestamp for debugging
		structure.serverTime = new Date().toISOString();

		res.json(structure);
	} catch (error) {
		console.error("Error reading folder structure:", error);
		res.status(500).json({
			error: "Failed to read folder structure",
			message: error.message,
			serverTime: new Date().toISOString(),
		});
	}
});

// Handle 404s
app.use((req, res) => {
	res.status(404).json({ error: "Not found" });
});

// Error handling middleware
app.use((err, req, res, next) => {
	console.error(err);
	res.status(500).json({
		error: "Internal server error",
		message: err.message,
		serverTime: new Date().toISOString(),
	});
});

module.exports = app;

if (require.main === module) {
	const port = process.env.PORT || 3000;
	app.listen(port, () => {
		console.log(`Server running on port ${port}`);
	});
}
