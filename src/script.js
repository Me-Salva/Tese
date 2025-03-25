import * as THREE from "three";
import ThreeGlobe from "three-globe";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

var renderer, camera, scene, controls, mainGlobe, glowGlobe;
var countriesData, arcsData;
var arcsArray = [];
let countryCodeToName = {};
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredArc = null;
let globeInitialized = false;
let isPlaying = false;
let animationInterval = null;
let currentYear = 1951;
const minYear = 1951;
const maxYear = 2025;

// Filter state variables
let currentFilterState = {
    selectedCountryCodes: [],
    showTransfersIn: true,
    showTransfersOut: true,
    filtersApplied: false
};

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

init();
loadInitialData();
onWindowResize();
animate();

function init() {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    var ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    var hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
    scene.add(hemisphereLight);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 0, 400);
    scene.add(camera);

    var dLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dLight.position.set(-800, 2000, 400);
    scene.add(dLight);

    var dLight1 = new THREE.DirectionalLight(0xffffff, 1);
    dLight1.position.set(-200, 500, 200);
    scene.add(dLight1);

    var dLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    dLight2.position.set(200, -500, -200);
    scene.add(dLight2);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.minDistance = 160;
    controls.maxDistance = 300;
    controls.autoRotate = false;
    controls.minPolarAngle = Math.PI / 4;
    controls.maxPolarAngle = Math.PI / 2;

    window.addEventListener("resize", onWindowResize, false);

    // Set up toggle events for countries
    const selectAllCheckbox = document.getElementById("selectAll");
    selectAllCheckbox.addEventListener("change", toggleAllCountries);

    const continentCheckboxes = document.querySelectorAll('.continent-checkbox');
    continentCheckboxes.forEach(checkbox => {
        checkbox.addEventListener("change", toggleContinent);
    });

    const timeSlider = document.getElementById("time-slider");
    timeSlider.addEventListener("input", debounce(() => {
        currentYear = parseInt(timeSlider.value);
        document.getElementById("current-year").textContent = currentYear;
        loadArcsForYear(currentYear);
    }, 200));

    // Set up time control buttons
    setupTimeControls();

    document.addEventListener("DOMContentLoaded", function () {
        const filtersDiv = document.getElementById("filters");
        const toggleButton = document.getElementById("toggle-filters");
    
        filtersDiv.style.display = "none";
        toggleButton.textContent = "Mostrar Filtros";
    
        toggleButton.addEventListener("click", function () {
            if (filtersDiv.style.display === "none" || filtersDiv.style.display === "") {
                filtersDiv.style.display = "block";
                toggleButton.textContent = "Esconder Filtros";
            } else {
                filtersDiv.style.display = "none";
                toggleButton.textContent = "Mostrar Filtros";
            }
        });
    });

    window.addEventListener('mousemove', onMouseMove, false);
    
    // Set up auto filtering
    setupAutoFiltering();
}

// Setup auto filtering for all checkboxes
function setupAutoFiltering() {
    // Add event listeners to all country checkboxes
    const countryCheckboxes = document.querySelectorAll('input[name="country"]');
    countryCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            applyFilter();
        });
    });

    // Add event listeners to transfer direction checkboxes
    const transferInCheckbox = document.getElementById("showTransfersIn");
    const transferOutCheckbox = document.getElementById("showTransfersOut");
    const showAllTransfersCheckbox = document.getElementById("showAllTransfers");
    
    transferInCheckbox.addEventListener('change', () => {
        // Update the "Show All Transfers" checkbox state
        if (transferOutCheckbox.checked && transferInCheckbox.checked) {
            showAllTransfersCheckbox.checked = true;
        } else {
            showAllTransfersCheckbox.checked = false;
        }
        applyFilter();
    });
    
    transferOutCheckbox.addEventListener('change', () => {
        // Update the "Show All Transfers" checkbox state
        if (transferOutCheckbox.checked && transferInCheckbox.checked) {
            showAllTransfersCheckbox.checked = true;
        } else {
            showAllTransfersCheckbox.checked = false;
        }
        applyFilter();
    });
    
    // Add event listener for the "Show All Transfers" checkbox
    showAllTransfersCheckbox.addEventListener('change', () => {
        if (showAllTransfersCheckbox.checked) {
            transferInCheckbox.checked = true;
            transferOutCheckbox.checked = true;
        } else {
            transferInCheckbox.checked = false;
            transferOutCheckbox.checked = false;
        }
        applyFilter();
    });

    // Optionally hide or disable the Apply Filter button since it's no longer needed
    const applyFilterButton = document.getElementById("applyFilter");
    if (applyFilterButton) {
        // Option 1: Hide the button
        applyFilterButton.style.display = 'none';
        
        // Option 2: Or keep it but with a different label as a "Reset Filters" button
        // applyFilterButton.textContent = "Reset Filters";
        // applyFilterButton.onclick = resetFilters;
    }
}

// Optional: Add a reset filters function if you want to keep the button as a reset option
function resetFilters() {
    // Reset all country checkboxes to checked
    const countryCheckboxes = document.querySelectorAll('input[name="country"]');
    countryCheckboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
    
    // Reset continent checkboxes
    const continentCheckboxes = document.querySelectorAll('.continent-checkbox');
    continentCheckboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
    
    // Reset select all checkbox
    const selectAllCheckbox = document.getElementById("selectAll");
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = true;
    }
    
    // Reset transfer direction checkboxes
    const transferInCheckbox = document.getElementById("showTransfersIn");
    const transferOutCheckbox = document.getElementById("showTransfersOut");
    const showAllTransfersCheckbox = document.getElementById("showAllTransfers");
    
    if (transferInCheckbox) transferInCheckbox.checked = true;
    if (transferOutCheckbox) transferOutCheckbox.checked = true;
    if (showAllTransfersCheckbox) showAllTransfersCheckbox.checked = true;
    
    // Apply the reset filters
    applyFilter();
}

// Setup time controls (play/pause, forward, backward)
function setupTimeControls() {
    const playPauseBtn = document.getElementById('play-pause-btn');
    const forwardBtn = document.getElementById('forward-btn');
    const backwardBtn = document.getElementById('backward-btn');
    
    // Play/Pause button event
    playPauseBtn.addEventListener('click', () => {
        togglePlayPause(playPauseBtn);
    });
    
    // Forward button event
    forwardBtn.addEventListener('click', () => {
        goToNextYear();
    });
    
    // Backward button event
    backwardBtn.addEventListener('click', () => {
        goToPreviousYear();
    });
}

// Toggle play/pause state
function togglePlayPause(button) {
    isPlaying = !isPlaying;
    
    if (isPlaying) {
        // Change to pause icon
        button.innerHTML = '&#9616;&#9616;'; // Pause icon
        button.classList.add('playing');
        
        // Start animation
        startYearAnimation();
    } else {
        // Change to play icon
        button.innerHTML = '&#9658;'; // Play icon
        button.classList.remove('playing');
        
        // Stop animation
        stopYearAnimation();
    }
}

// Start year animation
function startYearAnimation() {
    if (animationInterval) {
        clearInterval(animationInterval);
    }
    
    // Advance year every 2 seconds
    animationInterval = setInterval(() => {    
        if (currentYear < maxYear) {
            currentYear++;
            updateYearDisplay();
        } else {
            togglePlayPause(document.getElementById('play-pause-btn'));
        }    
    }, 2000);
}

// Stop year animation
function stopYearAnimation() {
    if (animationInterval) {
        clearInterval(animationInterval);
        animationInterval = null;
    }
}

// Go to next year
function goToNextYear() {
    if (currentYear < maxYear) {
        currentYear++;
        updateYearDisplay();
    }
}

// Go to previous year
function goToPreviousYear() {
    if (currentYear > minYear) {
        currentYear--;
        updateYearDisplay();
    }
}

// Update year display and load arcs for the current year
function updateYearDisplay() {
    // Update slider value
    const timeSlider = document.getElementById("time-slider");
    timeSlider.value = currentYear;
    
    // Update year text
    document.getElementById("current-year").textContent = currentYear;
    
    // Load arcs for the new year
    loadArcsForYear(currentYear);
}

// Load initial data and create the globe
async function loadInitialData() {
    try {
        // Load countries data (only need to do this once)
        const countriesResponse = await fetch("./files/maps/countriesToday.json");
        countriesData = await countriesResponse.json();

        // Load country code to name mapping
        const mapResponse = await fetch("./files/map.json");
        const mapData = await mapResponse.json();

        mapData.coordinates.forEach((country) => {
            const code = country.text;
            const name = country.country;
            countryCodeToName[code] = name;
        });

        // Initialize the globe with countries data
        initGlobe(countriesData);
        
        // Now load the initial arcs data for the starting year
        currentYear = parseInt(document.getElementById("time-slider").value) || minYear;
        document.getElementById("current-year").textContent = currentYear;
        
        await loadArcsForYear(currentYear);
        
    } catch (error) {
        console.error("Error loading initial data:", error);
    }
}

// Load arcs data for a specific year
async function loadArcsForYear(year) {
    try {
        console.log(`Loading arcs for year: ${year}`);
        
        // Load the arcs data for this year
        const linesResponse = await fetch(`./files/arcs/lines_${year}.json`);
        arcsData = await linesResponse.json();

        // Process the arcs
        const arcsDataWithThickness = arcsData.arcs.map((arc) => ({
            startLat: arc.startLat,
            startLng: arc.startLong,
            endLat: arc.endLat,
            endLng: arc.endLong,
            thickness: arc.thickness,
            color: arc.color,
            from: arc.from,
            to: arc.to,
            count: arc.count,
            players: arc.players,
        }));
        
        // If filters have been applied, reapply them to the new data
        if (currentFilterState.filtersApplied) {
            applyCurrentFilters();
        } else {
            // Otherwise, just show all arcs
            updateArcs(arcsDataWithThickness);
        }
        
    } catch (error) {
        console.error(`Error loading arcs for year ${year}:`, error);
    }
}

function toggleAllCountries(event) {
    const selectAllCheckbox = event.target;
    const countryCheckboxes = document.querySelectorAll('input[name="country"]');
    const continentCheckboxes = document.querySelectorAll('.continent-checkbox');

    countryCheckboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });
    continentCheckboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });
    
    // Apply filter after toggling all countries
    setTimeout(() => applyFilter(), 0);
}

function toggleContinent(event) {
    const continentCheckbox = event.target;
    const continentGroup = continentCheckbox.closest('.continent-group');
    const countryCheckboxes = continentGroup.querySelectorAll('input[name="country"]');

    countryCheckboxes.forEach(checkbox => {
        checkbox.checked = continentCheckbox.checked;
    });

    updateSelectAllCheckbox();
    
    // Apply filter after toggling continent
    setTimeout(() => applyFilter(), 0);
}

function updateSelectAllCheckbox() {
    const countryCheckboxes = document.querySelectorAll('input[name="country"]');
    const selectAllCheckbox = document.getElementById("selectAll");

    const allChecked = Array.from(countryCheckboxes).every(checkbox => checkbox.checked);
    selectAllCheckbox.checked = allChecked;
}

// Apply the current filter state to the arcs
function applyCurrentFilters() {
    if (!arcsData || !arcsData.arcs) return;
    
    // Get the select all checkbox state
    const selectAllCheckbox = document.getElementById("selectAll");
    const allCountriesSelected = selectAllCheckbox ? selectAllCheckbox.checked : true;
    
    // If no countries are selected (selectAllCheckbox is unchecked), show no arcs
    if (!allCountriesSelected && currentFilterState.selectedCountryCodes.length === 0) {
        console.log("No countries selected, showing no arcs");
        updateArcs([]);
        return;
    }
    
    const showAllTransfers = currentFilterState.showTransfersIn && currentFilterState.showTransfersOut;

    // If all countries are selected and both transfer directions are checked, show all arcs
    if (allCountriesSelected && showAllTransfers) {
        console.log("Showing all arcs - all countries and directions selected");
        
        const allArcsWithThickness = arcsData.arcs.map((arc) => ({
            startLat: arc.startLat,
            startLng: arc.startLong,
            endLat: arc.endLat,
            endLng: arc.endLong,
            thickness: arc.thickness,
            color: arc.color || "#FF0000", // Default to red if no color specified
            from: arc.from,
            to: arc.to,
            count: arc.count,
            scale: 0.5, // Default scale
            players: arc.players,
        }));
        
        updateArcs(allArcsWithThickness);
        return;
    }
    
    // If no transfer directions are selected, show no arcs
    if (!currentFilterState.showTransfersIn && !currentFilterState.showTransfersOut) {
        console.log("No transfer directions selected, showing no arcs");
        updateArcs([]);
        return;
    }

    // Filter arcs based on selected countries and transfer directions
    let filteredArcs = arcsData.arcs.filter(arc => {
        // If all countries are selected, include all arcs (if direction matches)
        if (allCountriesSelected) {
            return true;
        }
        
        // Otherwise, only include arcs that match the selected countries and directions
        const isTransferIn = currentFilterState.selectedCountryCodes.includes(arc.to) && currentFilterState.showTransfersIn;
        const isTransferOut = currentFilterState.selectedCountryCodes.includes(arc.from) && currentFilterState.showTransfersOut;
        
        return isTransferIn || isTransferOut;
    });

    console.log(`Filtered to ${filteredArcs.length} arcs out of ${arcsData.arcs.length} total`);

    // If only one country is selected, color the arcs based on direction
    if (currentFilterState.selectedCountryCodes.length === 1) {
        const selectedCountryCode = currentFilterState.selectedCountryCodes[0];
        
        filteredArcs = filteredArcs.map(arc => {
            // If the arc ends in the selected country, it's an incoming transfer (green)
            // If the arc starts from the selected country, it's an outgoing transfer (red)
            const isIncoming = arc.to === selectedCountryCode;
            const color = isIncoming ? "#00FF00" : "#FF0000";
            
            return {
                ...arc,
                color: color
            };
        });
    }

    const filteredArcsWithThickness = filteredArcs.map(arc => ({
        startLat: arc.startLat,
        startLng: arc.startLong,
        endLat: arc.endLat,
        endLng: arc.endLong,
        thickness: arc.thickness,
        color: arc.color,
        from: arc.from,
        to: arc.to,
        count: arc.count,
        scale: arc.color === "#00FF00" ? 0.3 : 0.5,
        players: arc.players,
    }));

    updateArcs(filteredArcsWithThickness);
    
    // Reset hover state when filters are applied
    if (hoveredArc) {
        hoveredArc = null;
        hideTooltip();
    }
}

function applyFilter() {
    // Get selected countries
    const selectedCountries = Array.from(document.querySelectorAll('input[name="country"]:checked')).map(checkbox => checkbox.value);
    
    // Create a reverse mapping from country names to country codes
    const countryNameToCode = {};
    Object.entries(countryCodeToName).forEach(([code, name]) => {
        countryNameToCode[name] = code;
    });
    
    // Get country codes for the selected countries
    const selectedCountryCodes = selectedCountries.map(name => countryNameToCode[name]).filter(Boolean);
    
    // Get transfer direction settings
    const showTransfersIn = document.getElementById("showTransfersIn").checked;
    const showTransfersOut = document.getElementById("showTransfersOut").checked;
    
    // Update the current filter state
    currentFilterState = {
        selectedCountryCodes: selectedCountryCodes,
        showTransfersIn: showTransfersIn,
        showTransfersOut: showTransfersOut,
        filtersApplied: true
    };
    
    // Apply the filters
    applyCurrentFilters();
}

function createCountryBorders(countries) {
    const borderMaterial = new THREE.LineBasicMaterial({ color: "#d6dbdf", linewidth: 1 });
    const bordersGroup = new THREE.Group();

    countries.features.forEach((country) => {
        const coordinates = country.geometry.coordinates;

        if (country.geometry.type === "Polygon") {
            coordinates.forEach((polygon) => {
                const points = polygon.map(([lng, lat]) => {
                    const phi = (90 - lat) * (Math.PI / 180);
                    const theta = (lng + 90) * (Math.PI / 180);
                    const radius = 100.7;
                    return new THREE.Vector3(
                        -radius * Math.sin(phi) * Math.cos(theta),
                        radius * Math.cos(phi),
                        radius * Math.sin(phi) * Math.sin(theta)
                    );
                });

                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const borderLine = new THREE.Line(geometry, borderMaterial);
                bordersGroup.add(borderLine);
            });
        } else if (country.geometry.type === "MultiPolygon") {
            coordinates.forEach((multiPolygon) => {
                multiPolygon.forEach((polygon) => {
                    const points = polygon.map(([lng, lat]) => {
                        const phi = (90 - lat) * (Math.PI / 180);
                        const theta = (lng + 90) * (Math.PI / 180);
                        const radius = 100.7;
                        return new THREE.Vector3(
                            -radius * Math.sin(phi) * Math.cos(theta),
                            radius * Math.cos(phi),
                            radius * Math.sin(phi) * Math.sin(theta)
                        );
                    });

                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    const borderLine = new THREE.Line(geometry, borderMaterial);
                    bordersGroup.add(borderLine);
                });
            });
        }
    });

    return bordersGroup;
}

function initGlobe(countries) {
    if (globeInitialized) return; // Only initialize once
    
    console.log("Initializing globe");
    
    // Create glow globe
    glowGlobe = new ThreeGlobe({
        waitForGlobeReady: true,
        animateIn: true,
    })
        .showAtmosphere(false)
        .arcsData([])
        .arcColor((arc) => arc.color || "#FF0000")
        .arcAltitudeAutoScale((arc) => arc.scale || 0.5)
        .arcStroke((arc) => arc.stroke || 0.1)
        .arcDashLength(1)
        .arcDashGap(0)
        .arcDashAnimateTime(2000)
        .arcsTransitionDuration(1000);
    
    glowGlobe.scale.set(100, 100, 100);
    scene.add(glowGlobe);

    // Create main globe
    mainGlobe = new ThreeGlobe({
        waitForGlobeReady: true,
        animateIn: true,
    })
        .polygonsData(countries.features)
        .polygonAltitude(0.005)
        .polygonCapColor(() => "#abb2b9")
        .polygonSideColor(() => "#abb2b9")
        .showAtmosphere(true)
        .atmosphereColor("#f8f9f9")
        .atmosphereAltitude(0.25)
        .arcsData([])
        .arcColor((arc) => arc.color || "#FF0000")
        .arcAltitudeAutoScale((arc) => arc.scale || 0.5)
        .arcStroke((arc) => arc.stroke || 0.1)
        .arcDashLength(0.25)
        .arcDashGap(0.25)
        .arcDashAnimateTime(2000)
        .arcsTransitionDuration(1000);

    const globeMaterial = mainGlobe.globeMaterial();
    globeMaterial.emissive = new THREE.Color("#f8f9f9");
    globeMaterial.emissiveIntensity = 0.2;
    globeMaterial.shininess = 0.8;

    mainGlobe.scale.set(100, 100, 100);
    scene.add(mainGlobe);

    const borders = createCountryBorders(countries);
    scene.add(borders);
    
    globeInitialized = true;
}

// Update only the arcs without recreating the globe
function updateArcs(arcsData) {
    arcsArray = [];

    const arcsWithThickness = arcsData.map((arc) => ({
        ...arc,
        stroke: arc.thickness || 0.1,
    }));

    const glowArcs = arcsData.map((arc) => {
        const hexToRgb = (hex) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return { r, g, b };
        };

        const { r, g, b } = hexToRgb(arc.color || "#FF0000");

        return {
            ...arc,
            stroke: (arc.thickness || 0.1) * 1.2,
            color: `rgba(${r}, ${g}, ${b}, 0.25)`,
        };
    });

    // Update arcs with smooth transition
    mainGlobe.arcsData(arcsWithThickness);
    glowGlobe.arcsData(glowArcs);

    arcsArray = mainGlobe.arcsData();
    
    // Reset hover state when arcs are updated
    if (hoveredArc) {
        hoveredArc = null;
        hideTooltip();
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

function latLonToVector3(lat, lon, radius = 100) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 90) * (Math.PI / 180);

    const x = -radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);

    return new THREE.Vector3(x, y, z);
}

// Generate points along an arc path with proper altitude
function generateArcPoints(startLat, startLng, endLat, endLng, scale, numPoints = 30) {
    const points = [];
    const start = latLonToVector3(startLat, startLng, 100);
    const end = latLonToVector3(endLat, endLng, 100);
    
    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        // Create a point along the arc
        const point = new THREE.Vector3().lerpVectors(start, end, t);
        
        // Apply altitude curve to the point
        const altitude = scale || 0.5;
        const altitudeFactor = Math.sin(t * Math.PI) * altitude;
        const elevated = point.clone().normalize().multiplyScalar(100 * (1 + altitudeFactor * 0.4));
        
        points.push(elevated);
    }
    
    return points;
}

function onMouseMove(event) {
    // Update mouse coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    
    let closestArc = null;
    let closestDistance = Infinity;

    if (!arcsArray || arcsArray.length === 0) return;

    // Check each arc
    arcsArray.forEach((arc) => {
        // Generate more points along the arc for better detection
        const arcPoints = generateArcPoints(
            arc.startLat, 
            arc.startLng, 
            arc.endLat, 
            arc.endLng, 
            arc.scale,
            50 // Increased number of points for better detection
        );
        
        // Check each segment of the arc
        let minDistanceToArc = Infinity;
        
        for (let i = 0; i < arcPoints.length - 1; i++) {
            const start = arcPoints[i];
            const end = arcPoints[i + 1];
            
            // Project both points to screen space
            const startScreen = start.clone().project(camera);
            const endScreen = end.clone().project(camera);
            
            // Convert to screen coordinates
            const startX = (startScreen.x * 0.5 + 0.5) * window.innerWidth;
            const startY = (startScreen.y * -0.5 + 0.5) * window.innerHeight;
            const endX = (endScreen.x * 0.5 + 0.5) * window.innerWidth;
            const endY = (endScreen.y * -0.5 + 0.5) * window.innerHeight;
            
            // Calculate distance from mouse to this line segment in screen space
            const mouseX = event.clientX;
            const mouseY = event.clientY;
            
            // Line segment distance calculation in 2D
            const A = mouseX - startX;
            const B = mouseY - startY;
            const C = endX - startX;
            const D = endY - startY;
            
            const dot = A * C + B * D;
            const lenSq = C * C + D * D;
            let param = -1;
            
            if (lenSq !== 0) {
                param = dot / lenSq;
            }
            
            let xx, yy;
            
            if (param < 0) {
                xx = startX;
                yy = startY;
            } else if (param > 1) {
                xx = endX;
                yy = endY;
            } else {
                xx = startX + param * C;
                yy = startY + param * D;
            }
            
            const dx = mouseX - xx;
            const dy = mouseY - yy;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < minDistanceToArc) {
                minDistanceToArc = distance;
            }
        }
        
        // If this arc is closer than previous closest, update
        if (minDistanceToArc < closestDistance) {
            closestDistance = minDistanceToArc;
            closestArc = arc;
        }
    });

    // Threshold for hover detection - increased for better usability
    const hoverThreshold = 20; // Increased threshold
    
    if (closestArc && closestDistance < hoverThreshold) {
        if (hoveredArc !== closestArc) {
            // Set new hovered arc
            hoveredArc = closestArc;
            
            // Show tooltip
            showTooltip(closestArc, event.clientX, event.clientY);
        } else {
            // Update tooltip position even if the arc hasn't changed
            updateTooltipPosition(event.clientX, event.clientY);
        }
    } else {
        if (hoveredArc !== null) {
            // Hide tooltip
            hideTooltip();
            hoveredArc = null;
        }
    }
}

// Add this new function to update tooltip position without changing content
function updateTooltipPosition(clientX, clientY) {
    const tooltip = document.getElementById('tooltip');
    if (!tooltip || tooltip.style.display === 'none') return;
    
    const offsetX = 15;
    const offsetY = 15;
    
    // Ensure tooltip stays within viewport
    const tooltipWidth = tooltip.offsetWidth || 150;
    const tooltipHeight = tooltip.offsetHeight || 80;
    
    const left = Math.min(clientX + offsetX, window.innerWidth - tooltipWidth - 5);
    const top = Math.min(clientY + offsetY, window.innerHeight - tooltipHeight - 5);
    
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
}

function showTooltip(arc, clientX, clientY) {
    const tooltip = document.getElementById('tooltip');
    if (!tooltip) return;

    const arcData = arc;
    const originCountry = countryCodeToName[arcData.from] || "País Desconhecido";
    const destinationCountry = countryCodeToName[arcData.to] || "País Desconhecido";
    const playerCount = arcData.count;
    const playersList = arcData.players;
    const playersDisplay = playersList.length > 0 ? playersList.join(", ") : "Nenhum jogador disponível";

    tooltip.innerHTML = `
        <strong>Origem:</strong> ${originCountry}<br>
        <strong>Destino:</strong> ${destinationCountry}<br>
        <strong>Jogadores (${playerCount}):</strong> ${playersDisplay}
    `;

    tooltip.style.display = 'block';
    updateTooltipPosition(clientX, clientY);
}

function hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
    }
}