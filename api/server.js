// api/server.js
const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const app = express();

// Serve static files from the public directory
app.use(express.static("public"));

// Function to recursively get folder structure
async function getFolderStructure(dirPath) {
	const items = await fs.readdir(dirPath, { withFileTypes: true });
	const structure = {
		folders: [],
		images: [],
	};

	for (const item of items) {
		const fullPath = path.join(dirPath, item.name);
		const relativePath = path.relative("public", fullPath);

		if (item.isDirectory()) {
			structure.folders.push({
				name: item.name,
				type: "folder",
				path: relativePath,
				content: await getFolderStructure(fullPath),
			});
		} else if (isImageFile(item.name)) {
			structure.images.push({
				name: item.name,
				type: "image",
				path: relativePath,
			});
		}
	}

	return structure;
}

// Helper function to check if file is an image
function isImageFile(filename) {
	const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
	return imageExtensions.some((ext) => filename.toLowerCase().endsWith(ext));
}

// API endpoint to get folder structure
app.get("/api/folder-structure", async (req, res) => {
	try {
		const structure = await getFolderStructure("public/imgs");
		res.json(structure);
	} catch (error) {
		console.error("Error reading folder structure:", error);
		res.status(500).json({ error: "Failed to read folder structure" });
	}
});

// Export as serverless function
module.exports = app;
