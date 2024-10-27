class ImageGallery {
	constructor() {
		this.currentPath = "";
		this.currentPage = 1;
		this.itemsPerPage = 30;
		this.folderStructure = null;
		this.swiper = null;
		this.isZoomEnabled = false;
		this.zoomLevel = 1;
		this.isDragging = false;
		this.startPoint = { x: 0, y: 0 };
		this.currentPoint = { x: 0, y: 0 };
		this.lastTap = 0; // For double tap detection

		this.init();
	}

	async init() {
		await this.loadFolderStructure();
		this.setupEventListeners();
		this.renderSidebar();
		this.navigateToPath("");
		this.initializeSwiper();
		this.setupFilters();
	}

	setupFilters() {
		// Connect all filter changes to update content
		["#dateFilter", "#sortOrder", "#searchInput"].forEach((selector) => {
			const element = document.querySelector(selector);
			if (element) {
				element.addEventListener("change", () => this.applyFilters());
				element.addEventListener(
					"input",
					debounce(() => this.applyFilters(), 300)
				);
			}
		});
	}

	async applyFilters() {
		const searchQuery =
			document.querySelector("#searchInput")?.value?.toLowerCase() || "";
		const dateFilter = document.querySelector("#dateFilter")?.value || "";
		const sortOrder = document.querySelector("#sortOrder")?.value || "";

		const content = this.getContentAtPath(this.currentPath);
		if (!content) return;

		let filteredContent = {
			folders: [...content.folders],
			images: [...content.images],
		};

		// Apply search filter
		if (searchQuery) {
			filteredContent = {
				folders: filteredContent.folders.filter((folder) =>
					folder.name.toLowerCase().includes(searchQuery)
				),
				images: filteredContent.images.filter((image) =>
					image.name.toLowerCase().includes(searchQuery)
				),
			};
		}

		// Apply date filter
		if (dateFilter) {
			const now = new Date();
			const dayInMs = 86400000; // 24 hours in milliseconds

			filteredContent.images = filteredContent.images.filter((img) => {
				const imgDate = new Date(img.lastModified);

				switch (dateFilter) {
					case "today":
						return this.isSameDay(imgDate, now);
					case "week":
						const weekAgo = new Date(now - 7 * dayInMs);
						return imgDate >= weekAgo;
					case "month":
						return (
							imgDate.getMonth() === now.getMonth() &&
							imgDate.getFullYear() === now.getFullYear()
						);
					case "year":
						return imgDate.getFullYear() === now.getFullYear();
					default:
						return true;
				}
			});
		}

		// Apply sorting
		if (sortOrder) {
			const sortFn = this.getSortFunction(sortOrder);
			filteredContent.folders.sort(sortFn);
			filteredContent.images.sort(sortFn);
		}

		this.renderContent(filteredContent);
	}

	// Helper function to compare dates for same day
	isSameDay(date1, date2) {
		return (
			date1.getDate() === date2.getDate() &&
			date1.getMonth() === date2.getMonth() &&
			date1.getFullYear() === date2.getFullYear()
		);
	}

	getSortFunction(sortOrder) {
		const sortFunctions = {
			newest: (a, b) => (b.lastModified || 0) - (a.lastModified || 0),
			oldest: (a, b) => (a.lastModified || 0) - (b.lastModified || 0),
			name: (a, b) => a.name.localeCompare(b.name),
			nameDesc: (a, b) => b.name.localeCompare(a.name),
		};
		return sortFunctions[sortOrder] || sortFunctions.newest;
	}

	isWithinDateRange(timestamp, range) {
		const date = new Date(timestamp);
		const now = new Date();
		const dayInMs = 86400000;

		switch (range) {
			case "today":
				return date.toDateString() === now.toDateString();
			case "week":
				return now - date <= 7 * dayInMs;
			case "month":
				return (
					date.getMonth() === now.getMonth() &&
					date.getFullYear() === now.getFullYear()
				);
			case "year":
				return date.getFullYear() === now.getFullYear();
			default:
				return true;
		}
	}

	handleDoubleTap(e) {
		const currentTime = new Date().getTime();
		const tapLength = currentTime - this.lastTap;

		if (tapLength < 300 && tapLength > 0) {
			e.preventDefault();
			this.toggleZoom();
		}
		this.lastTap = currentTime;
	}

	toggleZoom() {
		this.isZoomEnabled = !this.isZoomEnabled;
		const activeSlide = this.swiper?.slides[this.swiper.activeIndex];
		if (!activeSlide) return;

		const img = activeSlide.querySelector("img");
		if (!img) return;

		if (this.isZoomEnabled) {
			this.zoomLevel = 2;
			img.style.transform = `scale(${this.zoomLevel})`;
			img.style.transition = "transform 0.3s ease";
		} else {
			this.zoomLevel = 1;
			img.style.transform = "";
			img.style.transition = "transform 0.3s ease";
		}
	}

	initializeSwiper() {
		this.swiper = new Swiper(".swiper", {
			navigation: {
				nextEl: ".swiper-button-next",
				prevEl: ".swiper-button-prev",
			},
			keyboard: {
				enabled: true,
			},
			zoom: {
				maxRatio: 3,
				minRatio: 1,
				toggle: true,
				containerClass: "swiper-zoom-container",
			},
			effect: "fade",
			fadeEffect: {
				crossFade: true,
			},
			speed: 300,
			spaceBetween: 50,
			on: {
				slideChange: () => {
					this.updateNavigationState();
					this.resetZoom();
				},
				zoomChange: (swiper, scale) => {
					this.zoomLevel = scale;
					this.isZoomEnabled = scale > 1;
					this.updateZoomState();
				},
			},
		});
	}

	setupModalEventListeners(modal) {
		// Close modal events
		modal
			.querySelector(".modal-overlay")
			.addEventListener("click", () => this.closeModal());
		modal
			.querySelector(".close-btn")
			.addEventListener("click", () => this.closeModal());

		// Fullscreen and zoom events
		modal
			.querySelector(".fullscreen-btn")
			.addEventListener("click", () => this.toggleFullscreen());
		modal
			.querySelector(".zoom-btn")
			.addEventListener("click", () => this.toggleZoom());

		// Keyboard navigation
		document.addEventListener("keydown", (e) => {
			if (!modal.classList.contains("active")) return;

			switch (e.key) {
				case "Escape":
					this.closeModal();
					break;
				case "ArrowLeft":
					this.swiper?.slidePrev();
					break;
				case "ArrowRight":
					this.swiper?.slideNext();
					break;
			}
		});

		// Double-click zoom
		modal.querySelector(".modal-content").addEventListener("dblclick", (e) => {
			e.preventDefault();
			this.toggleZoom();
		});

		// Touch events for double-tap zoom
		let lastTap = 0;
		modal.querySelector(".modal-content").addEventListener("touchend", (e) => {
			const currentTime = new Date().getTime();
			const tapLength = currentTime - lastTap;
			if (tapLength < 300 && tapLength > 0) {
				e.preventDefault();
				this.toggleZoom();
			}
			lastTap = currentTime;
		});
	}

	updateZoomState() {
		const zoomBtn = document.querySelector(".zoom-btn i");
		if (zoomBtn) {
			zoomBtn.className = this.isZoomEnabled
				? "fas fa-search-minus"
				: "fas fa-search-plus";
		}

		// Update cursor style
		const modalContent = document.querySelector(".modal-content");
		if (modalContent) {
			modalContent.style.cursor = this.isZoomEnabled ? "grab" : "default";
		}
	}

	resetZoom() {
		if (this.isZoomEnabled) {
			this.swiper?.zoom.out();
			this.isZoomEnabled = false;
			this.zoomLevel = 1;
			this.updateZoomState();
		}
	}

	renderSidebar() {
		const sidebarContainer = document.querySelector(".folder-tree");
		sidebarContainer.innerHTML = "";
		this.renderFolderTree(this.folderStructure, sidebarContainer, "");
	}

	renderFolderTree(structure, container, currentPath) {
		const ul = document.createElement("ul");
		ul.className = "folder-list";

		// Add root folder if we're at the top level
		if (!currentPath) {
			const rootItem = document.createElement("div");
			rootItem.className = "folder-item root";
			rootItem.innerHTML = `
                <span class="folder-icon">📁</span>
                <span class="folder-name">Root</span>
            `;
			rootItem.addEventListener("click", () => this.navigateToPath(""));
			container.appendChild(rootItem);
		}

		structure.folders.forEach((folder) => {
			const li = document.createElement("li");
			li.className = "folder-list-item";

			const folderDiv = document.createElement("div");
			folderDiv.className = "folder-item";
			if (
				this.currentPath === `${currentPath}/${folder.name}`.replace(/^\//, "")
			) {
				folderDiv.classList.add("active");
			}

			const hasSubfolders = folder.content.folders.length > 0;

			folderDiv.innerHTML = `
                ${
									hasSubfolders
										? '<span class="dropdown-icon">▶</span>'
										: '<span class="spacer"></span>'
								}
                <span class="folder-icon">📁</span>
                <span class="folder-name">${folder.name}</span>
                ${
									folder.content.images.length
										? `<span class="image-count">(${folder.content.images.length})</span>`
										: ""
								}
            `;

			folderDiv.addEventListener("click", (e) => {
				e.stopPropagation();
				const newPath = `${currentPath}/${folder.name}`.replace(/^\//, "");
				this.navigateToPath(newPath);

				if (hasSubfolders) {
					const dropdownIcon = folderDiv.querySelector(".dropdown-icon");
					const subFolders = li.querySelector(".folder-list");

					if (subFolders) {
						subFolders.style.display =
							subFolders.style.display === "none" ? "block" : "none";
						dropdownIcon.style.transform =
							subFolders.style.display === "none"
								? "rotate(0deg)"
								: "rotate(90deg)";
					}
				}
			});

			li.appendChild(folderDiv);

			// Recursively render subfolders
			if (hasSubfolders) {
				const newPath = `${currentPath}/${folder.name}`.replace(/^\//, "");
				this.renderFolderTree(folder.content, li, newPath);
			}

			ul.appendChild(li);
		});

		container.appendChild(ul);
	}

	updateSidebarState(path) {
		document.querySelectorAll(".folder-item").forEach((item) => {
			item.classList.remove("active");
		});

		const currentFolder = document.querySelector(
			`.folder-item[data-path="${path}"]`
		);
		if (currentFolder) {
			currentFolder.classList.add("active");
			this.expandParentFolders(currentFolder);
		}
	}

	expandParentFolders(element) {
		let parent = element.parentElement;
		while (parent && parent.classList.contains("folder-list-item")) {
			const folderList = parent.querySelector(".folder-list");
			if (folderList) {
				folderList.style.display = "block";
				const dropdownIcon = parent.querySelector(".dropdown-icon");
				if (dropdownIcon) {
					dropdownIcon.style.transform = "rotate(90deg)";
				}
			}
			parent = parent.parentElement.parentElement;
		}
	}

	renderBreadcrumb(path) {
		const breadcrumbContainer = document.querySelector(".breadcrumb");
		breadcrumbContainer.innerHTML = "";

		// Add home/root link
		const homeLink = document.createElement("span");
		homeLink.className = "breadcrumb-item";
		homeLink.innerHTML = '<span class="breadcrumb-icon">🏠</span> Home';
		homeLink.addEventListener("click", () => this.navigateToPath(""));
		breadcrumbContainer.appendChild(homeLink);

		if (!path) return;

		// Split path and create breadcrumb items
		const pathParts = path.split("/");
		let currentPath = "";

		pathParts.forEach((part, index) => {
			// Add separator
			const separator = document.createElement("span");
			separator.className = "breadcrumb-separator";
			separator.textContent = " › ";
			breadcrumbContainer.appendChild(separator);

			// Add path item
			currentPath += (currentPath ? "/" : "") + part;
			const pathItem = document.createElement("span");
			pathItem.className = "breadcrumb-item";
			if (index === pathParts.length - 1) {
				pathItem.classList.add("active");
			}
			pathItem.textContent = part;

			if (index < pathParts.length - 1) {
				pathItem.addEventListener("click", () =>
					this.navigateToPath(currentPath)
				);
			}

			breadcrumbContainer.appendChild(pathItem);
		});
	}

	async loadFolderStructure() {
		try {
			const response = await fetch("/api/folder-structure");
			this.folderStructure = await response.json();
		} catch (error) {
			console.error("Error loading folder structure:", error);
			this.folderStructure = { folders: [], images: [] };
		}
	}

	// Zoom Functions
	handleZoom(e) {
		const delta = Math.sign(e.deltaY);
		const zoomFactor = 0.1;
		const newZoom = this.zoomLevel - delta * zoomFactor;

		this.zoomLevel = Math.min(Math.max(1, newZoom), 3); // Limit zoom between 1x and 3x

		const image = document.querySelector(".swiper-slide-active img");
		if (image) {
			image.style.transform = `scale(${this.zoomLevel})`;
		}
	}

	sortContent(content, sortOrder) {
		const sorted = {
			folders: [...content.folders],
			images: [...content.images],
		};

		const sortFn = {
			newest: (a, b) => this.getFileDate(b) - this.getFileDate(a),
			oldest: (a, b) => this.getFileDate(a) - this.getFileDate(b),
			name: (a, b) => a.name.localeCompare(b.name),
			nameDesc: (a, b) => b.name.localeCompare(a.name),
		};

		if (sortOrder in sortFn) {
			sorted.folders.sort(sortFn[sortOrder]);
			sorted.images.sort(sortFn[sortOrder]);
		}

		return sorted;
	}

	// async navigateToPath(path) {
	// 	this.currentPath = path;
	// 	this.currentPage = 1;
	// 	const content = await this.getContentForPath(path);
	// 	this.renderBreadcrumb(path);
	// 	this.renderContent(content);
	// 	this.updateSidebarState(path);
	// }

	async getContentForPath(path) {
		// This would be replaced with actual API call in production
		return this.folderStructure[path] || { folders: [], images: [] };
	}

	toggleFullscreen() {
		const modalContent = document.querySelector(".modal-content");
		if (!document.fullscreenElement) {
			modalContent.requestFullscreen();
		} else {
			document.exitFullscreen();
		}
	}

	async handleSearch(query) {
		if (!query) {
			this.renderContent(await this.getContentForPath(this.currentPath));
			return;
		}

		const content = await this.getContentForPath(this.currentPath);
		const filteredContent = {
			folders: content.folders.filter((folder) =>
				folder.name.toLowerCase().includes(query.toLowerCase())
			),
			images: content.images.filter((image) =>
				image.name.toLowerCase().includes(query.toLowerCase())
			),
		};

		this.renderContent(filteredContent);
	}

	getContentAtPath(path) {
		let current = this.folderStructure;
		if (!path) return current;

		const parts = path.split("/");
		for (const part of parts) {
			const folder = current.folders.find((f) => f.name === part);
			if (folder) {
				current = folder.content;
			} else {
				return null;
			}
		}
		return current;
	}

	async navigateToPath(path) {
		this.currentPath = path;
		this.currentPage = 1;
		const content = this.getContentAtPath(path);

		if (content) {
			this.renderBreadcrumb(path);
			this.renderContent(content);
			this.updateSidebarState(path);
		} else {
			console.error("Path not found:", path);
		}
	}

	renderContent(content) {
		if (!content) return;

		const container = document.querySelector(".gallery-container");
		container.innerHTML = "";

		const startIndex = (this.currentPage - 1) * this.itemsPerPage;
		const endIndex = startIndex + this.itemsPerPage;

		// Combine folders and images
		const allItems = [
			...content.folders.map((folder) => ({
				...folder,
				type: "folder",
			})),
			...content.images.map((image) => ({
				...image,
				type: "image",
			})),
		];

		const paginatedItems = allItems.slice(startIndex, endIndex);

		paginatedItems.forEach((item) => {
			const element = this.createGalleryItem(item);
			container.appendChild(element);
		});

		this.renderPagination(allItems.length);
	}

	async handleSearch(query) {
		const searchQuery = query.toLowerCase();
		const currentContent = this.getContentAtPath(this.currentPath);

		if (!currentContent) return;

		if (!searchQuery) {
			this.renderContent(currentContent);
			return;
		}

		// Helper function to search in a folder recursively
		const searchInFolder = (folder) => {
			let results = {
				folders: [],
				images: [],
			};

			// Search in current folder
			if (folder.folders) {
				results.folders = folder.folders.filter((f) =>
					f.name.toLowerCase().includes(searchQuery)
				);
			}

			if (folder.images) {
				results.images = folder.images.filter((img) =>
					img.name.toLowerCase().includes(searchQuery)
				);
			}

			// Search in subfolders
			folder.folders?.forEach((subFolder) => {
				if (subFolder.content) {
					const subResults = searchInFolder(subFolder.content);
					results.images = [...results.images, ...subResults.images];
				}
			});

			return results;
		};

		const searchResults = searchInFolder(currentContent);
		this.renderContent(searchResults);
	}

	setupEventListeners() {
		const searchInput = document.querySelector("#searchInput");
		searchInput.addEventListener(
			"input",
			debounce((e) => this.handleSearch(e.target.value), 300)
		);

		document
			.querySelector(".modal-overlay")
			.addEventListener("click", () => this.closeModal());

		document
			.querySelector(".zoom-btn")
			.addEventListener("click", () => this.toggleZoom());

		document
			.querySelector(".fullscreen-btn")
			.addEventListener("click", () => this.toggleFullscreen());

		this.setupIntersectionObserver();
	}

	// initializeSwiper() {
	// 	this.swiper = new Swiper(".swiper", {
	// 		navigation: {
	// 			nextEl: ".swiper-button-next",
	// 			prevEl: ".swiper-button-prev",
	// 		},
	// 		zoom: {
	// 			maxRatio: 3,
	// 			minRatio: 1,
	// 		},
	// 		keyboard: {
	// 			enabled: true,
	// 			onlyInViewport: false,
	// 		},
	// 		effect: "fade",
	// 		fadeEffect: {
	// 			crossFade: true,
	// 		},
	// 		speed: 300,
	// 		spaceBetween: 50,
	// 		on: {
	// 			slideChange: () => {
	// 				this.updateNavigationState();
	// 			},
	// 		},
	// 	});
	// }

	updateNavigationState() {
		if (!this.swiper) return;

		const { isBeginning, isEnd } = this.swiper;
		const prevButton = this.swiper.navigation.prevEl;
		const nextButton = this.swiper.navigation.nextEl;

		if (prevButton) {
			prevButton.classList.toggle("swiper-button-disabled", isBeginning);
			prevButton.setAttribute("aria-disabled", isBeginning);
		}

		if (nextButton) {
			nextButton.classList.toggle("swiper-button-disabled", isEnd);
			nextButton.setAttribute("aria-disabled", isEnd);
		}
	}
	createGalleryItem(item) {
		const div = document.createElement("div");
		div.className = "gallery-item";

		if (item.type === "folder") {
			div.innerHTML = `
                <div class="folder-preview">
                    <i class="fas fa-folder fa-3x"></i>
                    <div class="folder-name">${item.name}</div>
                </div>
            `;
			div.addEventListener("click", () => {
				const newPath = this.currentPath
					? `${this.currentPath}/${item.name}`
					: item.name;
				this.navigateToPath(newPath);
			});
		} else {
			const img = document.createElement("img");
			img.className = "skeleton";
			img.dataset.src = item.path;
			img.alt = item.name;

			const loadingOverlay = document.createElement("div");
			loadingOverlay.className = "loading-overlay";
			loadingOverlay.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

			div.appendChild(loadingOverlay);
			div.appendChild(img);

			// Add click event listener to the div instead of the img
			div.addEventListener("click", (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.openModal(item);
			});

			img.addEventListener("load", () => {
				img.classList.remove("skeleton");
				loadingOverlay.style.display = "none";
			});

			this.observer.observe(img);
		}

		return div;
	}

	openModal(image) {
		const modal = document.querySelector(".modal");
		if (!modal) return;

		modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content">
                <button class="modal-btn close-btn">
                    <i class="fas fa-times"></i>
                </button>
                <button class="modal-btn fullscreen-btn">
                    <i class="fas fa-expand"></i>
                </button>
                <button class="modal-btn zoom-btn">
                    <i class="fas fa-search-plus"></i>
                </button>
                <div class="swiper">
                    <div class="swiper-wrapper"></div>
                    <div class="swiper-button-next"></div>
                    <div class="swiper-button-prev"></div>
                </div>
            </div>
        `;

		modal.classList.add("active");
		document.body.style.overflow = "hidden"; // Prevent background scrolling

		// Setup event listeners
		this.setupModalEventListeners(modal);

		// Initialize Swiper
		this.initializeSwiper();

		// Add images to Swiper
		const currentContent = this.getContentAtPath(this.currentPath);
		if (!currentContent || !currentContent.images) return;

		const images = currentContent.images;
		images.forEach((img) => {
			const slide = document.createElement("div");
			slide.className = "swiper-slide";
			slide.innerHTML = `
                <div class="swiper-zoom-container">
                    <img src="${img.path}" alt="${img.name}">
                </div>
            `;
			this.swiper.appendSlide(slide);
		});

		// Set initial slide
		const currentIndex = images.findIndex((img) => img.path === image.path);
		if (currentIndex !== -1) {
			this.swiper.slideTo(currentIndex, 0);
		}

		this.updateNavigationState();
	}

	renderPagination(totalItems) {
		const totalPages = Math.ceil(totalItems / this.itemsPerPage);
		const pagination = document.querySelector(".pagination");
		pagination.innerHTML = "";

		if (totalPages <= 1) return;

		for (let i = 1; i <= totalPages; i++) {
			const button = document.createElement("button");
			button.className = `pagination-btn ${
				i === this.currentPage ? "active" : ""
			}`;
			button.textContent = i;
			button.addEventListener("click", () => {
				if (i !== this.currentPage) {
					this.currentPage = i;
					const content = this.getContentAtPath(this.currentPath);
					this.renderContent(content);
				}
			});
			pagination.appendChild(button);
		}
	}

	setupIntersectionObserver() {
		const options = {
			root: null,
			rootMargin: "300px",
			threshold: 0.1,
		};

		this.observer = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					const img = entry.target;
					if (img.dataset.src) {
						const tempImg = new Image();
						tempImg.onload = () => {
							img.src = tempImg.src;
							img.removeAttribute("data-src");
							img.classList.remove("skeleton");
							const loadingOverlay =
								img.parentElement.querySelector(".loading-overlay");
							if (loadingOverlay) {
								loadingOverlay.style.display = "none";
							}
						};
						tempImg.src = img.dataset.src;
						this.observer.unobserve(img);
					}
				}
			});
		}, options);
	}

	closeModal() {
		const modal = document.querySelector(".modal");
		modal.classList.add("fade-out");

		setTimeout(() => {
			modal.classList.remove("active");
			modal.classList.remove("fade-out");
			this.isZoomEnabled = false;
			document.body.style.cursor = "default";

			if (this.swiper) {
				const activeSlide = this.swiper.slides[this.swiper.activeIndex];
				if (activeSlide) {
					const zoomContainer = activeSlide.querySelector(
						".swiper-zoom-container"
					);
					if (zoomContainer && zoomContainer.style.transform) {
						zoomContainer.style.transform = "";
					}
				}
			}
		}, 300);
	}
}

// Utility function for debouncing
function debounce(func, wait) {
	let timeout;
	return function executedFunction(...args) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

// Initialize the gallery
document.addEventListener("DOMContentLoaded", () => {
	new ImageGallery();
});
