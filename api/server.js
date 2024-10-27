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

// Function to recursively get folder structure
async function getFolderStructure(dirPath) {
	try {
		const items = await fs.readdir(dirPath, { withFileTypes: true });
		const structure = {
			folders: [],
			images: [],
		};

		for (const item of items) {
			const fullPath = path.join(dirPath, item.name);
			const relativePath = path.relative(
				path.join(__dirname, "../public"),
				fullPath
			);

			if (item.isDirectory()) {
				structure.folders.push({
					name: item.name,
					type: "folder",
					path: relativePath,
					content: await getFolderStructure(fullPath),
				});
			} else if (isImageFile(item.name)) {
				const stats = await fs.stat(fullPath);
				structure.images.push({
					name: item.name,
					type: "image",
					path: relativePath.replace(/\\/g, "/"),
					lastModified: stats.mtime.getTime(),
				});
			}
		}

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
		const structure = await getFolderStructure(
			path.join(__dirname, "../public/imgs")
		);
		res.json(structure);
	} catch (error) {
		console.error("Error reading folder structure:", error);
		res.status(500).json({ error: "Failed to read folder structure" });
	}
});

// Handle 404s
app.use((req, res) => {
	res.status(404).json({ error: "Not found" });
});

// Error handling middleware
app.use((err, req, res, next) => {
	console.error(err);
	res.status(500).json({ error: "Internal server error" });
});

// Export the Express app
module.exports = app;

// Start the server if running directly
if (require.main === module) {
	const port = process.env.PORT || 3000;
	app.listen(port, () => {
		console.log(`Server running on port ${port}`);
	});
}
