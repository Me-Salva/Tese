import * as THREE from "three"
import ThreeGlobe from "three-globe"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

//=============================================================================
// GLOBAL VARIABLES AND CONSTANTS
//=============================================================================

// Core visualization variables
let renderer, camera, scene, controls, mainGlobe, glowGlobe
let globeInitialized = false

// Data variables
let countriesData, arcsData
let arcsArray = []
const countryCodeToName = {}
const country_info = {}
const allYearsData = {} // Store data for all years
let allPlayers = [] // All players
let playerDatabase = {}

// Interaction variables
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
let hoveredArc = null

// Time control variables
let isPlaying = false
let animationInterval = null
let currentYear = 1950
const minYear = 1950
const maxYear = 2025
let animationSpeed = 1 // Default animation speed

// Player career path tracking
let playerCareerMode = false
let playerCareerArcs = []
let playerName = ""
let firstPlayerTransferYear = null
let playerSearchResults = []
let selectedPlayerId = null

// Player career animation variables
let playerTransferAnimationInterval = null
let currentTransferIndex = 0
const transferAnimationDuration = 3000 // 3 seconds per transfer

// Theme variables
let currentTheme = "light"
const themeColors = {
  light: {
    waterColor: "#E6EEF2",
    countryColor: "#D6D6D6",
    borderColor: "#999999",
    backgroundColor: "#FFFFFF",
    atmosphereColor: "#f8f9f9",
  },
  dark: {
    waterColor: "#262E36",
    countryColor: "#21262C",
    borderColor: "#AAAAAA",
    backgroundColor: "#1A1A1A",
    atmosphereColor: "#2E3A45",
  },
}

// Arc colors
const arcColors = {
  default: "#F76B15", // Orange for general arcs
  exit: "#2DA6E0", // Blue for exits in 1 country view
  player: "#25E009", // Green for player view
}

// Filter state variables
let currentFilterState = {
  selectedCountryCodes: [],
  showTransfersIn: true,
  showTransfersOut: true,
  sourceCountryCode: null,
  destCountryCode: null,
  playerName: null,
  countryToCountryFilterActive: false,
  playerFilterActive: false,
  bidirectionalFilter: false,
  filtersApplied: false,
}

// Store country flags for the player
let playerCountryFlags = []

//=============================================================================
// INITIALIZATION AND MAIN EXECUTION
//=============================================================================

// Main initialization function
function init() {
  // Load saved theme
  loadSavedTheme()

  // Setup renderer
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  document.body.appendChild(renderer.domElement)

  // Setup scene
  scene = new THREE.Scene()
  scene.background = new THREE.Color(themeColors[currentTheme].backgroundColor)

  // Setup lighting
  setupLighting()

  // Setup camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000)
  camera.position.set(0, 0, 400)
  scene.add(camera)

  // Setup controls
  setupOrbitControls()

  // Setup event listeners
  window.addEventListener("resize", onWindowResize, false)
  window.addEventListener("mousemove", onMouseMove, false)

  // Setup UI controls
  setupUIControls()
  setupLegendTooltip()

  // Setup theme toggle
  const themeToggle = document.getElementById("theme-toggle")
  if (themeToggle) {
    themeToggle.addEventListener("click", toggleTheme)
  }
}

// Setup lighting for the scene
function setupLighting() {
  var ambientLight = new THREE.AmbientLight(0xffffff, 1.2)
  scene.add(ambientLight)

  var hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5)
  scene.add(hemisphereLight)

  // Add directional lights
  var dLight = new THREE.DirectionalLight(0xffffff, 0.8)
  dLight.position.set(-800, 2000, 400)
  scene.add(dLight)

  var dLight1 = new THREE.DirectionalLight(0xffffff, 1)
  dLight1.position.set(-200, 500, 200)
  scene.add(dLight1)

  var dLight2 = new THREE.DirectionalLight(0xffffff, 0.5)
  dLight2.position.set(200, -500, -200)
  scene.add(dLight2)
}

// Setup orbit controls
function setupOrbitControls() {
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.enablePan = false
  controls.minDistance = 160
  controls.maxDistance = 300
  controls.autoRotate = false
  controls.minPolarAngle = Math.PI / 4
  controls.maxPolarAngle = Math.PI / 2
}

// Handle window resize
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

// Animation loop
function animate() {
  controls.update()
  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}

// Initialize the globe with countries data
function initGlobe(countries) {
  if (globeInitialized) return // Only initialize once

  // Create glow globe
  glowGlobe = new ThreeGlobe({
    waitForGlobeReady: true,
    animateIn: true,
  })
    .showAtmosphere(false)
    .arcsData([])
    .arcColor((arc) => arc.color || arcColors.default)
    .arcAltitudeAutoScale((arc) => arc.scale || 0.5)
    .arcStroke((arc) => arc.stroke || 0.1)
    .arcDashLength(1)
    .arcDashGap(0)
    .arcDashAnimateTime(2000)
    .arcsTransitionDuration(1000)

  glowGlobe.scale.set(100, 100, 100)
  scene.add(glowGlobe)

  // Create main globe
  mainGlobe = new ThreeGlobe({
    waitForGlobeReady: true,
    animateIn: true,
  })
    .polygonsData(countries.features)
    .polygonAltitude(0.005)
    .polygonCapColor(() => themeColors[currentTheme].countryColor)
    .polygonSideColor(() => themeColors[currentTheme].countryColor)
    .showAtmosphere(true)
    .atmosphereColor(themeColors[currentTheme].atmosphereColor)
    .atmosphereAltitude(0.25)
    .arcsData([])
    .arcColor((arc) => arc.color || arcColors.default)
    .arcAltitudeAutoScale((arc) => arc.scale || 0.5)
    .arcStroke((arc) => arc.stroke || 0.1)
    .arcDashLength(0.25)
    .arcDashGap(0.25)
    .arcDashAnimateTime(2000)
    .arcsTransitionDuration(1000)

  const globeMaterial = mainGlobe.globeMaterial()
  globeMaterial.color = new THREE.Color(themeColors[currentTheme].waterColor)
  globeMaterial.emissive = new THREE.Color(themeColors[currentTheme].atmosphereColor)
  globeMaterial.emissiveIntensity = 0.2
  globeMaterial.shininess = 0.8

  mainGlobe.scale.set(100, 100, 100)
  scene.add(mainGlobe)

  const borders = createCountryBorders(countries)
  borders.name = "countryBorders"
  scene.add(borders)

  globeInitialized = true
}

//=============================================================================
// DATA LOADING AND PROCESSING
//=============================================================================

// Load initial data
async function loadInitialData() {
  try {
    // Load countries data (only need to do this once)
    const countriesResponse = await fetch("./files/maps/countriesToday.json")
    countriesData = await countriesResponse.json()

    // Load country code to name mapping
    const mapResponse = await fetch("./files/map.json")
    const mapData = await mapResponse.json()

    mapData.coordinates.forEach((country) => {
      const code = country.text
      const name = country.country
      countryCodeToName[code] = name

      // Store country coordinates for later use
      country_info[country.id] = {
        code: country.text,
        lat: country.lat,
        lng: country.lng,
      }
    })

    // Load player database if available
    try {
      const playerDbResponse = await fetch("./files/players.json")
      const playerDbData = await playerDbResponse.json()
      playerDatabase = playerDbData.players || {}
      preloadFlagImages()
    } catch (error) {
      // Continue with fallback method if player database is not available
    }

    // Initialize the globe with countries data
    initGlobe(countriesData)

    // Load the initial arcs data for the starting year
    currentYear = Number.parseInt(document.getElementById("time-slider").value) || minYear
    document.getElementById("current-year").textContent = currentYear

    await loadArcsForYear(currentYear)

    // Build the player database
    allPlayers = await buildPlayerDatabase()

    // Initialize filters after data is loaded
    initializeFilters()
  } catch (error) {
    console.error("Error loading initial data:", error)
  }
}

// Build player database from available data
async function buildPlayerDatabase() {
  // Create a map to store unique players by ID
  const playerMap = new Map()

  // If we have a player database loaded, use that as the primary source
  if (Object.keys(playerDatabase).length > 0) {
    // Process each player in the database
    Object.entries(playerDatabase).forEach(([playerId, playerData]) => {
      // Use display_name if available, but remove position in parentheses if it exists
      let displayName = playerData.display_name || playerData.name
      // Remove position in parentheses if it exists
      displayName = displayName.replace(/\s+$[^)]+$/, "")

      playerMap.set(playerId, {
        id: playerId,
        name: displayName,
        birthDate: playerData.birthDate || "Unknown",
        position: playerData.position || "Unknown",
        transfersId: playerData.transfers_id || null,
        country_flags: playerData.country_flags || {},
      })
    })

    return Array.from(playerMap.values())
  }

  // Fallback to the old method if no database is available
  // Process each year's data
  for (let year = minYear; year <= maxYear; year++) {
    try {
      // Load data for this year if not already loaded
      if (!allYearsData[year]) {
        const linesResponse = await fetch(`./files/arcs/lines_${year}.json`)
        const yearData = await linesResponse.json()
        allYearsData[year] = yearData
      }

      // Process the data structure to extract player information
      const data = allYearsData[year]

      // Check if the data has the new structure with "data" property
      if (data.data && data.data.seasons) {
        // Process each season
        Object.entries(data.data.seasons).forEach(([seasonName, season]) => {
          // Process each team
          season.forEach((team) => {
            // Process incoming transfers
            if (team.teams_in) {
              Object.entries(team.teams_in).forEach(([countryId, country]) => {
                if (country.players) {
                  // Add each player to the map
                  Object.entries(country.players).forEach(([playerId, playerData]) => {
                    playerMap.set(playerId, {
                      id: playerId,
                      name: playerData.name || "Desconhecido",
                      birthDate: playerData.dt_nascimento || "Desconhecida",
                      position: playerData.posicao || "Desconhecida",
                      transfersId: playerData.transfers_id || null,
                      country_flags: {},
                    })
                  })
                }
              })
            }

            // Process outgoing transfers
            if (team.teams_out) {
              Object.entries(team.teams_out).forEach(([countryId, country]) => {
                if (country.players) {
                  // Add each player to the map
                  Object.entries(country.players).forEach(([playerId, playerData]) => {
                    playerMap.set(playerId, {
                      id: playerId,
                      name: playerData.name || "Desconhecido",
                      birthDate: playerData.dt_nascimento || "Desconhecida",
                      position: playerData.posicao || "Desconhecida",
                      transfersId: playerData.transfers_id || null,
                      country_flags: {},
                    })
                  })
                }
              })
            }
          })
        })
      } else {
        // Handle the old data structure if needed
        if (data.arcs) {
          data.arcs.forEach((arc) => {
            if (arc.players) {
              arc.players.forEach((playerName) => {
                // Create placeholder entries for players without IDs
                const playerId = `placeholder_${playerName.replace(/\s+/g, "_")}`
                if (!playerMap.has(playerId)) {
                  playerMap.set(playerId, {
                    id: playerId,
                    name: playerName,
                    birthDate: "Desconhecida",
                    position: "Desconhecida",
                    country_flags: {},
                  })
                }
              })
            }
          })
        }
      }
    } catch (error) {
      console.error(`Error processing player data for year ${year}:`, error)
    }
  }

  return Array.from(playerMap.values())
}

// Load arcs data for a specific year
async function loadArcsForYear(year) {
  try {
    // Check if we already have data for this year
    if (allYearsData[year]) {
      arcsData = allYearsData[year]
    } else {
      // Load the arcs data for this year
      const linesResponse = await fetch(`./files/arcs/lines_${year}.json`)
      arcsData = await linesResponse.json()

      // Store the data for future use
      allYearsData[year] = arcsData
    }

    // If no filters are applied, show all arcs
    if (!currentFilterState.filtersApplied) {
      const arcsDataWithThickness = arcsData.arcs.map((arc) => ({
        startLat: arc.startLat,
        startLng: arc.startLong,
        endLat: arc.endLat,
        endLng: arc.endLong,
        color: arcColors.default,
        from: arc.from,
        to: arc.to,
        count: arc.count,
        players: arc.players,
      }))
      updateArcs(arcsDataWithThickness)
      return
    }

    // Check if no countries are selected and no other filters are active
    if (
      currentFilterState.selectedCountryCodes.length === 0 &&
      !currentFilterState.countryToCountryFilterActive &&
      !currentFilterState.playerFilterActive
    ) {
      // If no countries are selected, show no arcs
      updateArcs([])
      return
    }

    // Apply the current filters to the new data
    applyCurrentFilters()
  } catch (error) {
    console.error(`Error loading arcs for year ${year}:`, error)
  }
}

// Update only the arcs without recreating the globe
function updateArcs(arcsData) {
  arcsArray = []

  const arcsWithThickness = arcsData.map((arc) => ({
    ...arc,
    stroke: Math.max(0.05, (arc.count / 10) * 0.25),
  }))

  const glowArcs = arcsData.map((arc) => {
    const hexToRgb = (hex) => {
      const r = Number.parseInt(hex.slice(1, 3), 16)
      const g = Number.parseInt(hex.slice(3, 5), 16)
      const b = Number.parseInt(hex.slice(5, 7), 16)
      return { r, g, b }
    }

    const { r, g, b } = hexToRgb(arc.color || arcColors.default)

    return {
      ...arc,
      stroke: Math.max(0.06, (arc.count / 10) * 0.3),
      color: `rgba(${r}, ${g}, ${b}, 0.25)`,
    }
  })

  // Update arcs with smooth transition
  mainGlobe.arcsData(arcsWithThickness)
  glowGlobe.arcsData(glowArcs)

  arcsArray = mainGlobe.arcsData()

  // Reset hover state when arcs are updated
  if (hoveredArc) {
    hoveredArc = null
    hideTooltip()
  }
}

// Preload all years data
async function preloadAllYearsData() {
  // Create an array of promises for loading all years
  const loadPromises = []

  for (let year = minYear; year <= maxYear; year++) {
    if (!allYearsData[year]) {
      const promise = fetch(`./files/arcs/lines_${year}.json`)
        .then((response) => response.json())
        .then((data) => {
          allYearsData[year] = data
        })
        .catch((error) => {
          console.error(`Error loading data for year ${year}:`, error)
        })

      loadPromises.push(promise)
    }
  }

  // Wait for all data to be loaded
  await Promise.all(loadPromises)
}

//=============================================================================
// THEME MANAGEMENT
//=============================================================================

// Toggle between light and dark themes
function toggleTheme() {
  currentTheme = currentTheme === "light" ? "dark" : "light"

  // Update HTML data attribute
  document.documentElement.setAttribute("data-theme", currentTheme)

  // Update scene background
  if (scene) {
    scene.background = new THREE.Color(themeColors[currentTheme].backgroundColor)
  }

  // Update globe colors if initialized
  if (globeInitialized && mainGlobe) {
    updateGlobeColors()
  }

  // Update theme toggle icon
  updateThemeIcon()

  // Save theme preference
  localStorage.setItem("theme", currentTheme)
}

// Update the theme toggle icon based on current theme
function updateThemeIcon() {
  const themeToggle = document.getElementById("theme-toggle")
  if (themeToggle) {
    if (currentTheme === "dark") {
      themeToggle.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      `
    } else {
      themeToggle.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      `
    }
  }
}

// Update globe colors based on current theme
function updateGlobeColors() {
  if (!mainGlobe || !glowGlobe) return

  // Update main globe colors
  mainGlobe
    .polygonCapColor(() => themeColors[currentTheme].countryColor)
    .polygonSideColor(() => themeColors[currentTheme].countryColor)
    .atmosphereColor(themeColors[currentTheme].atmosphereColor)

  // Update globe material
  const globeMaterial = mainGlobe.globeMaterial()
  globeMaterial.color = new THREE.Color(themeColors[currentTheme].waterColor)
  globeMaterial.emissive = new THREE.Color(themeColors[currentTheme].atmosphereColor)
  globeMaterial.emissiveIntensity = 0.2
  globeMaterial.shininess = 0.8

  // Update country borders
  updateCountryBorders()
}

// Update country borders based on current theme
function updateCountryBorders() {
  // Remove old borders
  const oldBorders = scene.getObjectByName("countryBorders")
  if (oldBorders) {
    scene.remove(oldBorders)
  }

  // Create new borders with current theme color
  if (countriesData) {
    const borders = createCountryBorders(countriesData)
    borders.name = "countryBorders"
    scene.add(borders)
  }
}

// Load theme from local storage or system preference
function loadSavedTheme() {
  // Check for saved theme preference
  const savedTheme = localStorage.getItem("theme")

  if (savedTheme) {
    currentTheme = savedTheme
  } else {
    // Check for system preference
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      currentTheme = "dark"
    }
  }

  // Apply theme
  document.documentElement.setAttribute("data-theme", currentTheme)
  updateThemeIcon()
}

// Create country borders for the globe
function createCountryBorders(countries) {
  const borderMaterial = new THREE.LineBasicMaterial({
    color: themeColors[currentTheme].borderColor,
    linewidth: 1,
  })
  const bordersGroup = new THREE.Group()

  countries.features.forEach((country) => {
    const coordinates = country.geometry.coordinates

    if (country.geometry.type === "Polygon") {
      coordinates.forEach((polygon) => {
        const points = polygon.map(([lng, lat]) => {
          const phi = (90 - lat) * (Math.PI / 180)
          const theta = (lng + 90) * (Math.PI / 180)
          const radius = 100.7
          return new THREE.Vector3(
            -radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.cos(phi),
            radius * Math.sin(phi) * Math.sin(theta),
          )
        })

        const geometry = new THREE.BufferGeometry().setFromPoints(points)
        const borderLine = new THREE.Line(geometry, borderMaterial)
        bordersGroup.add(borderLine)
      })
    } else if (country.geometry.type === "MultiPolygon") {
      coordinates.forEach((multiPolygon) => {
        multiPolygon.forEach((polygon) => {
          const points = polygon.map(([lng, lat]) => {
            const phi = (90 - lat) * (Math.PI / 180)
            const theta = (lng + 90) * (Math.PI / 180)
            const radius = 100.7
            return new THREE.Vector3(
              -radius * Math.sin(phi) * Math.cos(theta),
              radius * Math.cos(phi),
              radius * Math.sin(phi) * Math.sin(theta),
            )
          })

          const geometry = new THREE.BufferGeometry().setFromPoints(points)
          const borderLine = new THREE.Line(geometry, borderMaterial)
          bordersGroup.add(borderLine)
        })
      })
    }
  })

  return bordersGroup
}

//=============================================================================
// UI CONTROLS SETUP
//=============================================================================

// Setup all UI controls
function setupUIControls() {
  // Setup country selection controls
  const selectAllCheckbox = document.getElementById("selectAll")
  selectAllCheckbox.addEventListener("change", toggleAllCountries)

  const continentCheckboxes = document.querySelectorAll(".continent-checkbox")
  continentCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", toggleContinent)
  })

  // Setup time slider
  const timeSlider = document.getElementById("time-slider")
  timeSlider.addEventListener(
    "input",
    debounce(() => {
      currentYear = Number.parseInt(timeSlider.value)
      document.getElementById("current-year").textContent = currentYear

      if (playerCareerMode) {
        updatePlayerCareerPath(currentYear)
      } else {
        loadArcsForYear(currentYear)
      }
    }, 200),
  )

  // Set up time control buttons
  setupTimeControls()

  // Setup filter tabs
  setupFilterTabs()

  // Setup exit player view button
  const exitPlayerViewBtn = document.getElementById("exit-player-view")
  if (exitPlayerViewBtn) {
    exitPlayerViewBtn.addEventListener("click", exitPlayerCareerMode)
  }
}

function setupLegendTooltip() {
  const infoBtn = document.getElementById("info-button")
  const tooltip = document.getElementById("legend-tooltip")

  if (!infoBtn || !tooltip) return

  infoBtn.addEventListener("mouseenter", () => {
    tooltip.style.display = "block"
  })

  infoBtn.addEventListener("mouseleave", () => {
    tooltip.style.display = "none"
  })

  tooltip.addEventListener("mouseenter", () => {
    tooltip.style.display = "block"
  })

  tooltip.addEventListener("mouseleave", () => {
    tooltip.style.display = "none"
  })
}

// Setup filter tabs
function setupFilterTabs() {
  const filterTabs = document.querySelectorAll(".filter-tab")
  const filterPanels = document.querySelectorAll(".filter-panel")

  // Add click event to each tab
  filterTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      // Get the panel ID from the tab's data attribute
      const panelId = tab.getAttribute("data-panel")
      const panel = document.getElementById(panelId)

      // Check if this tab is already active
      const isActive = tab.classList.contains("active")

      // Remove active class from all tabs and panels
      filterTabs.forEach((t) => t.classList.remove("active"))
      filterPanels.forEach((p) => {
        p.style.display = "none"
        p.classList.remove("active")
      })

      // If the tab wasn't active before, make it active
      if (!isActive) {
        tab.classList.add("active")
        panel.classList.add("active")
        panel.style.display = "block"
      }
    })
  })
}

//=============================================================================
// TIME CONTROLS
//=============================================================================

// Setup time controls (play/pause, forward, backward)
function setupTimeControls() {
  const playPauseBtn = document.getElementById("play-pause-btn")
  const forwardBtn = document.getElementById("forward-btn")
  const backwardBtn = document.getElementById("backward-btn")
  const speedToggleBtn = document.getElementById("speed-toggle-btn")

  // Play/Pause button event
  playPauseBtn.addEventListener("click", () => {
    togglePlayPause(playPauseBtn)
  })

  // Forward button event
  forwardBtn.addEventListener("click", () => {
    goToNextYear()
  })

  // Backward button event
  backwardBtn.addEventListener("click", () => {
    goToPreviousYear()
  })

  // Speed toggle button event
  speedToggleBtn.addEventListener("click", () => {
    toggleAnimationSpeed(speedToggleBtn)
  })
}

// Update the togglePlayPause function to handle SVG icons
function togglePlayPause(button) {
  isPlaying = !isPlaying

  if (isPlaying) {
    // Change to pause icon
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="6" y="4" width="4" height="16"></rect>
        <rect x="14" y="4" width="4" height="16"></rect>
      </svg>
    `
    button.classList.add("playing")

    // Start animation
    startYearAnimation()
  } else {
    // Change to play icon
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
    `
    button.classList.remove("playing")

    // Stop animation
    stopYearAnimation()
  }
}

// Toggle animation speed between 1x and 2x
function toggleAnimationSpeed(button) {
  // Toggle between 1x and 2x speed
  animationSpeed = animationSpeed === 1 ? 2 : 1

  // Update button text
  button.textContent = animationSpeed === 2 ? "1x" : "2x"

  // If animation is currently playing, restart it with the new speed
  if (isPlaying) {
    stopYearAnimation()
    startYearAnimation()
  }
}

// Start year animation
function startYearAnimation() {
  if (animationInterval) {
    clearInterval(animationInterval)
  }

  // Advance year every 2 seconds (or 1 second if speed is 2x)
  const intervalTime = animationSpeed === 2 ? 1000 : 2000

  animationInterval = setInterval(() => {
    if (currentYear < maxYear) {
      currentYear++
      updateYearDisplay()
    } else {
      togglePlayPause(document.getElementById("play-pause-btn"))
    }
  }, intervalTime)
}

// Stop year animation
function stopYearAnimation() {
  if (animationInterval) {
    clearInterval(animationInterval)
    animationInterval = null
  }
}

// Go to next year
function goToNextYear() {
  if (currentYear < maxYear) {
    currentYear++
    updateYearDisplay()
  }
}

// Go to previous year
function goToPreviousYear() {
  if (currentYear > minYear) {
    currentYear--
    updateYearDisplay()
  }
}

// Update year display and load arcs for the current year
function updateYearDisplay() {
  // Update slider value
  const timeSlider = document.getElementById("time-slider")
  timeSlider.value = currentYear

  // Update year text
  document.getElementById("current-year").textContent = currentYear

  // Load arcs for the new year or update player career path
  if (playerCareerMode) {
    updatePlayerCareerPath(currentYear)
  } else {
    loadArcsForYear(currentYear)
  }
}

// Function to toggle time controls visibility
function toggleTimeControls(show) {
  const timeControls = document.querySelector(".time-controls")
  if (timeControls) {
    if (show) {
      timeControls.style.display = "flex"
    } else {
      timeControls.style.display = "none"
    }
  }
}

//=============================================================================
// FILTER CONTROLS
//=============================================================================

// Initialize all filters
function initializeFilters() {
  initAdvancedFilters()
  setupAutoFiltering()
}

// Initialize advanced filters
function initAdvancedFilters() {
  // Populate country dropdowns
  populateCountryDropdowns()

  // Set up event listener for reset country filter button
  const resetCountryFilterBtn = document.getElementById("resetCountryFilter")
  if (resetCountryFilterBtn) {
    resetCountryFilterBtn.addEventListener("click", resetCountryToCountryFilter)
  }
}

// Populate country dropdowns with automatic filtering
function populateCountryDropdowns() {
  const sourceDropdown = document.getElementById("sourceCountry")
  const destDropdown = document.getElementById("destinationCountry")

  if (!sourceDropdown || !destDropdown) return

  // Clear existing options except the first one
  sourceDropdown.innerHTML = '<option value="">Selecione um país</option>'
  destDropdown.innerHTML = '<option value="">Selecione um país</option>'

  // Get all country names from the countryCodeToName object
  const countryNames = Object.values(countryCodeToName).sort()

  // Add options for each country
  countryNames.forEach((country) => {
    const sourceOption = document.createElement("option")
    sourceOption.value = country
    sourceOption.textContent = country
    sourceDropdown.appendChild(sourceOption)

    const destOption = document.createElement("option")
    destOption.value = country
    destOption.textContent = country
    destDropdown.appendChild(destOption)
  })

  // Add event listeners for automatic filtering
  sourceDropdown.addEventListener("change", () => {
    if (sourceDropdown.value && destDropdown.value) {
      applyCountryToCountryFilter()
    } else if (!sourceDropdown.value && !destDropdown.value) {
      resetCountryToCountryFilter()
    }
  })

  destDropdown.addEventListener("change", () => {
    if (sourceDropdown.value && destDropdown.value) {
      applyCountryToCountryFilter()
    } else if (!sourceDropdown.value && !destDropdown.value) {
      resetCountryToCountryFilter()
    }
  })
}

// Setup auto filtering for country checkboxes and transfer direction
function setupAutoFiltering() {
  // Add event listeners to all country checkboxes
  const countryCheckboxes = document.querySelectorAll('input[name="country"]')
  countryCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      // Exit player career mode if active
      if (playerCareerMode) {
        exitPlayerCareerMode()
      }

      // Update the continent checkbox if all countries are unchecked
      updateContinentCheckbox(checkbox)

      applyFilter()
    })
  })

  // Add event listeners to transfer direction checkboxes
  const transferInCheckbox = document.getElementById("showTransfersIn")
  const transferOutCheckbox = document.getElementById("showTransfersOut")
  const showAllTransfersCheckbox = document.getElementById("showAllTransfers")

  if (transferInCheckbox) {
    transferInCheckbox.addEventListener("change", () => {
      // Exit player career mode if active
      if (playerCareerMode) {
        exitPlayerCareerMode()
      }

      // Update the "Show All Transfers" checkbox state
      if (transferOutCheckbox && transferOutCheckbox.checked && transferInCheckbox.checked) {
        if (showAllTransfersCheckbox) showAllTransfersCheckbox.checked = true
      } else {
        if (showAllTransfersCheckbox) showAllTransfersCheckbox.checked = false
      }
      applyFilter()
    })
  }

  if (transferOutCheckbox) {
    transferOutCheckbox.addEventListener("change", () => {
      // Exit player career mode if active
      if (playerCareerMode) {
        exitPlayerCareerMode()
      }

      // Update the "Show All Transfers" checkbox state
      if (transferInCheckbox && transferInCheckbox.checked && transferOutCheckbox.checked) {
        if (showAllTransfersCheckbox) showAllTransfersCheckbox.checked = true
      } else {
        if (showAllTransfersCheckbox) showAllTransfersCheckbox.checked = false
      }
      applyFilter()
    })
  }

  // Add event listener for the "Show All Transfers" checkbox
  if (showAllTransfersCheckbox) {
    showAllTransfersCheckbox.addEventListener("change", () => {
      // Exit player career mode if active
      if (playerCareerMode) {
        exitPlayerCareerMode()
      }

      if (showAllTransfersCheckbox.checked) {
        if (transferInCheckbox) transferInCheckbox.checked = true
        if (transferOutCheckbox) transferOutCheckbox.checked = true
      } else {
        if (transferInCheckbox) transferInCheckbox.checked = false
        if (transferOutCheckbox) transferOutCheckbox.checked = false
      }
      applyFilter()
    })
  }

  // Add autocomplete for player search
  setupPlayerAutocomplete()
}

// Setup player autocomplete with automatic filtering
function setupPlayerAutocomplete() {
  const playerNameInput = document.getElementById("playerName")
  const playerAutocomplete = document.getElementById("playerAutocomplete")

  if (playerNameInput) {
    playerNameInput.addEventListener(
      "input",
      debounce(() => {
        const searchTerm = playerNameInput.value.trim().toLowerCase()

        if (searchTerm.length < 2) {
          playerAutocomplete.style.display = "none"
          return
        }

        // Normalize the search term to handle accented characters
        const normalizedSearchTerm = searchTerm.normalize("NFD").replace(/[\u0300-\u036f]/g, "")

        // Filter players based on search term, handling accented characters
        playerSearchResults = allPlayers
          .filter((player) => {
            const normalizedName = player.name
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
            return normalizedName.includes(normalizedSearchTerm)
          })
          .slice(0, 10) // Limit to 10 results for performance

        // Display results
        if (playerSearchResults.length > 0) {
          playerAutocomplete.innerHTML = ""
          playerSearchResults.forEach((player) => {
            const item = document.createElement("a")
            item.href = "#"

            // Format birth date for display
            let birthDateDisplay = "Data desconhecida"
            if (player.birthDate && player.birthDate !== "Unknown") {
              try {
                const birthDate = new Date(player.birthDate)
                if (!isNaN(birthDate.getTime())) {
                  birthDateDisplay = birthDate.toLocaleDateString()
                }
              } catch (e) {
                // Error formatting date
              }
            }

            // Format position for display
            const positionDisplay =
              player.position && player.position !== "Unknown" ? player.position : "Posição desconhecida"

            item.innerHTML = `
              <strong>${player.name}</strong>
              <br>
              <small>${positionDisplay} | ${birthDateDisplay}</small>
            `

            item.addEventListener("click", (e) => {
              e.preventDefault()
              playerNameInput.value = player.name
              selectedPlayerId = player.id
              playerAutocomplete.style.display = "none"

              // Automatically apply the player filter when a player is selected
              applyPlayerCareerFilter()
            })

            playerAutocomplete.appendChild(item)
          })
          playerAutocomplete.style.display = "block"
        } else {
          playerAutocomplete.style.display = "none"
        }
      }, 300),
    )

    // Hide autocomplete when clicking outside
    document.addEventListener("click", (e) => {
      if (e.target !== playerNameInput && e.target !== playerAutocomplete) {
        playerAutocomplete.style.display = "none"
      }
    })
  }
}

// Toggle all countries
function toggleAllCountries(event) {
  const selectAllCheckbox = event.target
  const countryCheckboxes = document.querySelectorAll('input[name="country"]')
  const continentCheckboxes = document.querySelectorAll(".continent-checkbox")

  countryCheckboxes.forEach((checkbox) => {
    checkbox.checked = selectAllCheckbox.checked
  })
  continentCheckboxes.forEach((checkbox) => {
    checkbox.checked = selectAllCheckbox.checked
  })

  // Apply filter after toggling all countries
  setTimeout(() => applyFilter(), 0)
}

// Toggle continent countries
function toggleContinent(event) {
  const continentCheckbox = event.target
  const continentGroup = continentCheckbox.closest(".continent-group")
  const countryCheckboxes = continentGroup.querySelectorAll('input[name="country"]')

  countryCheckboxes.forEach((checkbox) => {
    checkbox.checked = continentCheckbox.checked
  })

  updateSelectAllCheckbox()

  // Apply filter after toggling continent
  setTimeout(() => applyFilter(), 0)
}

// Update select all checkbox state
function updateSelectAllCheckbox() {
  const countryCheckboxes = document.querySelectorAll('input[name="country"]')
  const selectAllCheckbox = document.getElementById("selectAll")

  const allChecked = Array.from(countryCheckboxes).every((checkbox) => checkbox.checked)
  selectAllCheckbox.checked = allChecked
}

// Update continent checkbox state
function updateContinentCheckbox(countryCheckbox) {
  // Find the continent group that contains this country checkbox
  const continentGroup = countryCheckbox.closest(".continent-group")
  if (!continentGroup) return

  // Find the continent checkbox in this group
  const continentCheckbox = continentGroup.querySelector(".continent-checkbox")
  if (!continentCheckbox) return

  // Get all country checkboxes in this continent group
  const countryCheckboxes = continentGroup.querySelectorAll('input[name="country"]')

  // Check if all country checkboxes are unchecked
  const allUnchecked = Array.from(countryCheckboxes).every((checkbox) => !checkbox.checked)

  // Update the continent checkbox accordingly
  continentCheckbox.checked = !allUnchecked

  // Also update the "Select All" checkbox
  updateSelectAllCheckbox()
}

// Apply filter based on selected countries and transfer directions
function applyFilter() {
  // Get selected countries
  const selectedCountries = Array.from(document.querySelectorAll('input[name="country"]:checked')).map(
    (checkbox) => checkbox.value,
  )

  // Create a reverse mapping from country names to country codes
  const countryNameToCode = {}
  Object.entries(countryCodeToName).forEach(([code, name]) => {
    countryNameToCode[name] = code
  })

  // Get country codes for the selected countries
  const selectedCountryCodes = selectedCountries.map((name) => countryNameToCode[name]).filter(Boolean)

  // Get transfer direction settings
  const showTransfersIn = document.getElementById("showTransfersIn").checked
  const showTransfersOut = document.getElementById("showTransfersOut").checked

  // Update the current filter state
  currentFilterState = {
    ...currentFilterState,
    selectedCountryCodes: selectedCountryCodes,
    showTransfersIn: showTransfersIn,
    showTransfersOut: showTransfersOut,
    filtersApplied: true,
  }

  // If no countries are selected and no other filters are active
  if (
    selectedCountryCodes.length === 0 &&
    !currentFilterState.countryToCountryFilterActive &&
    !currentFilterState.playerFilterActive
  ) {
    updateArcs([])
    return
  }

  // Apply the filters
  applyCurrentFilters()
}

// Apply the current filter state to the arcs
function applyCurrentFilters() {
  if (!arcsData || !arcsData.arcs) return

  // Start with all arcs
  let filteredArcs = [...arcsData.arcs]

  // Apply country selection filter if any countries are selected
  if (currentFilterState.selectedCountryCodes.length > 0) {
    filteredArcs = filteredArcs.filter((arc) => {
      const isTransferIn =
        currentFilterState.selectedCountryCodes.includes(arc.to) && currentFilterState.showTransfersIn
      const isTransferOut =
        currentFilterState.selectedCountryCodes.includes(arc.from) && currentFilterState.showTransfersOut
      return isTransferIn || isTransferOut
    })
  } else if (!currentFilterState.showTransfersIn || !currentFilterState.showTransfersOut) {
    // If no countries are selected but transfer directions are filtered
    filteredArcs = filteredArcs.filter((arc) => {
      return (
        (currentFilterState.showTransfersIn && currentFilterState.showTransfersOut) ||
        (currentFilterState.showTransfersIn && arc.to) ||
        (currentFilterState.showTransfersOut && arc.from)
      )
    })
  }

  // Apply country-to-country filter if active
  if (currentFilterState.countryToCountryFilterActive) {
    if (currentFilterState.bidirectionalFilter) {
      // Show transfers in both directions between the two selected countries
      filteredArcs = filteredArcs.filter((arc) => {
        return (
          // First direction: source -> destination
          (arc.from === currentFilterState.sourceCountryCode && arc.to === currentFilterState.destCountryCode) ||
          // Second direction: destination -> source
          (arc.from === currentFilterState.destCountryCode && arc.to === currentFilterState.sourceCountryCode)
        )
      })

      // Color the arcs based on direction relative to the source country
      filteredArcs = filteredArcs.map((arc) => {
        // If arc is from source to destination, color it blue (outgoing from source)
        // If arc is from destination to source, color it orange (incoming to source)
        const isOutgoingFromSource = arc.from === currentFilterState.sourceCountryCode
        const color = isOutgoingFromSource ? arcColors.exit : arcColors.default

        return {
          ...arc,
          color: color,
          // Apply different scaling based on direction
          scale: isOutgoingFromSource ? 0.5 : 0.3,
        }
      })
    } else {
      // Standard filtering (one or both countries specified, but not bidirectional)
      filteredArcs = filteredArcs.filter((arc) => {
        const sourceMatch = !currentFilterState.sourceCountryCode || arc.from === currentFilterState.sourceCountryCode
        const destMatch = !currentFilterState.destCountryCode || arc.to === currentFilterState.destCountryCode
        return sourceMatch && destMatch
      })
    }
  }

  // Apply player filter if active
  if (currentFilterState.playerFilterActive && currentFilterState.playerName) {
    const playerNameLower = currentFilterState.playerName.toLowerCase()
    filteredArcs = filteredArcs.filter((arc) => {
      return arc.players && arc.players.some((player) => player.toLowerCase().includes(playerNameLower))
    })

    // Use green color for player arcs
    filteredArcs = filteredArcs.map((arc) => ({
      ...arc,
      color: arcColors.player,
    }))
  }

  // If only one country is selected, color the arcs based on direction
  if (
    currentFilterState.selectedCountryCodes.length === 1 &&
    !currentFilterState.countryToCountryFilterActive &&
    !currentFilterState.playerFilterActive
  ) {
    const selectedCountryCode = currentFilterState.selectedCountryCodes[0]

    filteredArcs = filteredArcs.map((arc) => {
      const isIncoming = arc.to === selectedCountryCode
      const color = isIncoming ? arcColors.default : arcColors.exit // Orange for incoming, blue for outgoing

      return {
        ...arc,
        color: color,
        scale: isIncoming ? 0.3 : 0.5,
      }
    })
  }

  // Process the filtered arcs for display
  const filteredArcsWithThickness = filteredArcs.map((arc) => ({
    startLat: arc.startLat,
    startLng: arc.startLong,
    endLat: arc.endLat,
    endLng: arc.endLong,
    color: arc.color || arcColors.default,
    from: arc.from,
    to: arc.to,
    count: arc.count,
    scale: arc.scale !== undefined ? arc.scale : arc.color === arcColors.default ? 0.3 : 0.5,
    players: arc.players,
  }))

  // Update the visualization
  updateArcs(filteredArcsWithThickness)

  // Reset hover state when filters are applied
  if (hoveredArc) {
    hoveredArc = null
    hideTooltip()
  }
}

// Apply country-to-country filter
function applyCountryToCountryFilter() {
  // Exit player career mode if active
  if (playerCareerMode) {
    exitPlayerCareerMode()
  }

  const sourceCountry = document.getElementById("sourceCountry").value
  const destCountry = document.getElementById("destinationCountry").value

  if (!sourceCountry && !destCountry) {
    // If both dropdowns are empty, reset the filter
    resetCountryToCountryFilter()
    return
  }

  // Create a reverse mapping from country names to country codes
  const countryNameToCode = {}
  Object.entries(countryCodeToName).forEach(([code, name]) => {
    countryNameToCode[name] = code
  })

  // Get country codes
  const sourceCode = sourceCountry ? countryNameToCode[sourceCountry] : null
  const destCode = destCountry ? countryNameToCode[destCountry] : null

  // Update current filter state
  currentFilterState = {
    ...currentFilterState,
    sourceCountryCode: sourceCode,
    destCountryCode: destCode,
    countryToCountryFilterActive: true,
    bidirectionalFilter: sourceCode && destCode, // Flag for bidirectional filtering
    filtersApplied: true,
  }

  // Apply the filters
  applyCurrentFilters()
}

// Reset country-to-country filter
function resetCountryToCountryFilter() {
  const sourceDropdown = document.getElementById("sourceCountry")
  const destDropdown = document.getElementById("destinationCountry")

  if (sourceDropdown) sourceDropdown.value = ""
  if (destDropdown) destDropdown.value = ""

  // Update current filter state
  currentFilterState = {
    ...currentFilterState,
    sourceCountryCode: null,
    destCountryCode: null,
    countryToCountryFilterActive: false,
    bidirectionalFilter: false,
  }

  // Completely reset the filter state if this was the only active filter and not in player career mode
  if (
    !playerCareerMode &&
    !currentFilterState.playerFilterActive &&
    currentFilterState.selectedCountryCodes.length === 0
  ) {
    currentFilterState.filtersApplied = false
  }

  // If in player career mode, don't reload arcs
  if (playerCareerMode) {
    return
  }

  // Load arcs for the current year
  loadArcsForYear(currentYear)
}

//=============================================================================
// PLAYER CAREER PATH FUNCTIONALITY
//=============================================================================

// Apply player career filter
async function applyPlayerCareerFilter() {
  const playerNameInput = document.getElementById("playerName")
  if (!playerNameInput) return

  const inputPlayerName = playerNameInput.value.trim()

  if (!inputPlayerName) {
    alert("Por favor, digite o nome de um jogador.")
    return
  }

  // Check if a player was selected from the dropdown
  if (!selectedPlayerId) {
    alert("Por favor, selecione um jogador da lista de sugestões.")
    return
  }

  // Set player name and enter career mode
  playerName = inputPlayerName
  playerCareerMode = true
  playerCareerArcs = []
  firstPlayerTransferYear = null

  // Update filter state
  currentFilterState = {
    ...currentFilterState,
    playerName: inputPlayerName,
    playerFilterActive: true,
    filtersApplied: true,
  }

  // Hide time slider controls
  toggleTimeControls(false)

  // Preload all years data to find all player transfers
  await preloadAllYearsData()

  // Find all transfers for this player and show them at once
  await showAllPlayerTransfers(selectedPlayerId)
}

// Function to exit player career mode
function exitPlayerCareerMode() {
  playerCareerMode = false
  playerName = ""
  playerCareerArcs = []
  firstPlayerTransferYear = null

  // Stop the transfer animation if it's running
  if (playerTransferAnimationInterval) {
    clearInterval(playerTransferAnimationInterval)
    playerTransferAnimationInterval = null
  }

  // Reset player name input
  const playerNameInput = document.getElementById("playerName")
  if (playerNameInput) playerNameInput.value = ""
  selectedPlayerId = null

  // Reset filter state
  currentFilterState = {
    selectedCountryCodes: [],
    showTransfersIn: true,
    showTransfersOut: true,
    sourceCountryCode: null,
    destCountryCode: null,
    playerName: null,
    countryToCountryFilterActive: false,
    playerFilterActive: false,
    bidirectionalFilter: false,
    filtersApplied: false,
  }

  // Show time controls again
  toggleTimeControls(true)

  // Hide player info
  const playerInfo = document.getElementById("player-info")
  if (playerInfo) {
    playerInfo.style.display = "none"
  }

  // Reset the current year to the default value
  currentYear = Number.parseInt(document.getElementById("time-slider").value) || minYear
  document.getElementById("current-year").textContent = currentYear

  // Clear any existing tooltip
  hideTooltip()
  hoveredArc = null

  // Load arcs for the current year with all countries
  loadArcsForYear(currentYear)
}

// Show all transfers for a player
async function showAllPlayerTransfers(playerId) {
  // Get all arcs for this player across all years
  const allArcs = []

  // Check if we have this player in the database with transfer history
  if (playerDatabase[playerId] && playerDatabase[playerId].transfers) {
    // Get all transfers for this player
    const transfers = playerDatabase[playerId].transfers

    // Sort transfers by year (chronologically)
    const sortedTransfers = [...transfers].sort((a, b) => {
      const yearA = Number.parseInt(a.year)
      const yearB = Number.parseInt(b.year)
      return yearA - yearB
    })

    // Process each transfer to create arcs
    sortedTransfers.forEach((transfer) => {
      // Use the new field names from the updated database structure
      const fromCode = transfer.from_country || transfer.from
      const toCode = transfer.to_country || transfer.to
      const transferYear = transfer.year
      const fromClub = transfer.from_club_name || "Unknown Club"
      const toClub = transfer.to_club_name || "Unknown Club"

      // Get coordinates for the countries
      const fromCoords = getCountryCoordinatesFromCode(fromCode)
      const toCoords = getCountryCoordinatesFromCode(toCode)

      if (fromCoords && toCoords) {
        allArcs.push({
          startLat: fromCoords.lat,
          startLng: fromCoords.lng,
          endLat: toCoords.lat,
          endLng: toCoords.lng,
          color: arcColors.player, // Green for player career
          from: fromCode,
          to: toCode,
          count: 1, // Always 1 for a single player
          players: [playerName],
          year: transferYear, // Add year information
          stroke: 0.2, // Fixed stroke for player transfers
          fromClub: fromClub, // Add club information for tooltip
          toClub: toClub,
        })
      }
    })
  } else {
    // Fallback to searching through all years
    for (let year = minYear; year <= maxYear; year++) {
      if (allYearsData[year]) {
        const data = allYearsData[year]

        // Check if the data has the new structure
        if (data.data && data.data.seasons) {
          // Process each season
          Object.values(data.data.seasons).forEach((season) => {
            // Process each team
            season.forEach((team) => {
              const teamName = team.name
              const teamId = team.id

              // Process incoming transfers
              if (team.teams_in) {
                Object.entries(team.teams_in).forEach(([countryId, country]) => {
                  if (country.players && country.players[playerId]) {
                    // Found a transfer for this player
                    const player = country.players[playerId]
                    const fromCountry = country.country
                    const fromCountryCode = countryId
                    const toCountry = teamName
                    const toCountryCode = teamId

                    // Create an arc for this transfer
                    const fromCoords = getCountryCoordinatesFromCode(fromCountryCode)
                    const toCoords = getCountryCoordinatesFromCode(toCountryCode)

                    if (fromCoords && toCoords) {
                      allArcs.push({
                        startLat: fromCoords.lat,
                        startLng: fromCoords.lng,
                        endLat: toCoords.lat,
                        endLng: toCoords.lng,
                        color: arcColors.player, // Green for player career
                        from: fromCountryCode,
                        to: toCountryCode,
                        count: 1, // Always 1 for a single player
                        players: [player.name],
                        year: year, // Add year information
                        stroke: 0.2, // Fixed stroke for player transfers
                      })
                    }
                  }
                })
              }

              // Process outgoing transfers
              if (team.teams_out) {
                Object.entries(team.teams_out).forEach(([countryId, country]) => {
                  if (country.players && country.players[playerId]) {
                    // Found a transfer for this player
                    const player = country.players[playerId]
                    const toCountry = country.country
                    const toCountryCode = countryId
                    const fromCountry = teamName
                    const fromCountryCode = teamId

                    // Create an arc for this transfer
                    const fromCoords = getCountryCoordinatesFromCode(fromCountryCode)
                    const toCoords = getCountryCoordinatesFromCode(toCountryCode)

                    if (fromCoords && toCoords) {
                      allArcs.push({
                        startLat: fromCoords.lat,
                        startLng: fromCoords.lng,
                        endLat: toCoords.lat,
                        endLng: toCoords.lng,
                        color: arcColors.player, // Green for player career
                        from: fromCountryCode,
                        to: toCountryCode,
                        count: 1, // Always 1 for a single player
                        players: [player.name],
                        year: year, // Add year information
                        stroke: 0.5, // Fixed stroke for player transfers
                      })
                    }
                  }
                })
              }
            })
          })
        } else {
          // Fallback to old data structure
          const playerNameLower = playerName.toLowerCase()

          // Filter arcs for this player in this year
          const yearArcs = data.arcs.filter(
            (arc) => arc.players && arc.players.some((player) => player.toLowerCase().includes(playerNameLower))
          )

          // Process the arcs for display
          const processedArcs = yearArcs.map((arc) => {
            // Filter the players array to only include the matching player(s)
            const matchingPlayers = arc.players.filter((player) => player.toLowerCase().includes(playerNameLower))

            return {
              startLat: arc.startLat,
              startLng: arc.startLong,
              endLat: arc.endLat,
              endLng: arc.endLong,
              color: arcColors.player, // Green for player career
              from: arc.from,
              to: arc.to,
              count: 1, // Always 1 for a single player
              players: matchingPlayers,
              year: year, // Add year information
              stroke: 0.5, // Fixed stroke for player transfers
            }
          })

          allArcs.push(...processedArcs)
        }
      }
    }
  }

  // Sort the arcs by year (chronologically)
  let sortedArcs = allArcs.sort((a, b) => {
    const yearA = Number.parseInt(a.year)
    const yearB = Number.parseInt(b.year)
    return yearA - yearB
  })

  // Deduplicate transfers with the same origin and destination in consecutive years
  // Prefer the EARLIER year
  const uniqueTransfers = new Map()
  
  sortedArcs.forEach(transfer => {
    // Create a unique key that ignores the year but includes all other relevant data
    const dedupeKey = `${transfer.from}-${transfer.to}-${transfer.fromClub || ''}-${transfer.toClub || ''}`
    
    // If we already have this transfer and the years are consecutive, skip it
    if (uniqueTransfers.has(dedupeKey)) {
      const existingTransfer = uniqueTransfers.get(dedupeKey)
      const yearDiff = Math.abs(parseInt(existingTransfer.year) - parseInt(transfer.year))
      
      // If years are consecutive (difference of 1), it's likely a duplicate
      if (yearDiff <= 1) {
        // Keep the one with the EARLIER year
        if (parseInt(transfer.year) < parseInt(existingTransfer.year)) {
          uniqueTransfers.set(dedupeKey, transfer)
        }
        return // Skip adding this transfer again
      }
    }
    
    // Otherwise, add it to our map
    uniqueTransfers.set(dedupeKey, transfer)
  })
  
  // Replace the original array with deduplicated transfers
  playerCareerArcs = Array.from(uniqueTransfers.values())

  // Extract country flags for the player's path
  playerCountryFlags = []

  // First add the origin country of the first transfer
  if (playerCareerArcs.length > 0) {
    const firstTransfer = playerCareerArcs[0]
    const fromCountryCode = firstTransfer.from

    // Try to find the flag URL for this country
    const flagUrl = findCountryFlagUrl(fromCountryCode)
    if (flagUrl) {
      playerCountryFlags.push({
        code: fromCountryCode,
        flag: flagUrl,
        name: countryCodeToName[fromCountryCode] || fromCountryCode,
      })
    } else {
      // Fallback to a default flag or country code display
      playerCountryFlags.push({
        code: fromCountryCode,
        flag: `https://flagcdn.com/w20/${fromCountryCode.toLowerCase()}.png`,
        name: countryCodeToName[fromCountryCode] || fromCountryCode,
      })
    }
  }

  // Then add all destination countries in order (including duplicates)
  playerCareerArcs.forEach((arc) => {
    const toCountryCode = arc.to

    // Try to find the flag URL for this country
    const flagUrl = findCountryFlagUrl(toCountryCode)
    if (flagUrl) {
      playerCountryFlags.push({
        code: toCountryCode,
        flag: flagUrl,
        name: countryCodeToName[toCountryCode] || toCountryCode,
      })
    } else {
      // Fallback to a default flag or country code display
      playerCountryFlags.push({
        code: toCountryCode,
        flag: `https://flagcdn.com/w20/${toCountryCode.toLowerCase()}.png`,
        name: countryCodeToName[toCountryCode] || toCountryCode,
      })
    }
  })

  // Update the visualization with all arcs at once
  if (playerCareerArcs.length > 0) {
    // Create glow effect for all arcs (these will always be visible)
    const glowArcs = playerCareerArcs.map((arc) => {
      const hexToRgb = (hex) => {
        const r = Number.parseInt(hex.slice(1, 3), 16)
        const g = Number.parseInt(hex.slice(3, 5), 16)
        const b = Number.parseInt(hex.slice(5, 7), 16)
        return { r, g, b }
      }

      const { r, g, b } = hexToRgb(arc.color)

      return {
        ...arc,
        stroke: 0.6, // Slightly thicker for glow
        color: `rgba(${r}, ${g}, ${b}, 0.25)`,
      }
    })

    // Update glow globe with all arcs
    glowGlobe.arcsData(glowArcs)

    // Start the animation for the main arcs
    startPlayerTransferAnimation()

    // Show player info panel
    showPlayerInfo(playerName)
  } else {
    // No arcs found for this player
    mainGlobe.arcsData([])
    glowGlobe.arcsData([])
    arcsArray = []
    alert(`Nenhuma transferência encontrada para ${playerName}.`)
    exitPlayerCareerMode()
  }
}

// Function to start the player transfer animation
function startPlayerTransferAnimation() {
  // Clear any existing animation interval
  if (playerTransferAnimationInterval) {
    clearInterval(playerTransferAnimationInterval)
  }

  // Reset the current transfer index
  currentTransferIndex = 0

  // Show the first transfer
  showCurrentTransfer()

  // Set up the animation interval
  playerTransferAnimationInterval = setInterval(() => {
    // Move to the next transfer
    currentTransferIndex = (currentTransferIndex + 1) % playerCareerArcs.length
    showCurrentTransfer()
  }, transferAnimationDuration)
}

// Function to show the current transfer
function showCurrentTransfer() {
  if (playerCareerArcs.length === 0) return

  // Get the current transfer arc
  const currentArc = playerCareerArcs[currentTransferIndex]

  // Create an array with just the current arc
  const singleArcWithThickness = [
    {
      ...currentArc,
      stroke: 0.5, // Fixed stroke for player transfers
    },
  ]

  // Update the main globe with just this arc
  mainGlobe.arcsData(singleArcWithThickness)
  arcsArray = singleArcWithThickness

  // Update the player info to show the current transfer year
  const playerInfo = document.getElementById("player-info")
  if (playerInfo) {
    const title = playerInfo.querySelector("h3")
    if (title) {
      const fromClub = currentArc.fromClub || countryCodeToName[currentArc.from] || "Unknown"
      const toClub = currentArc.toClub || countryCodeToName[currentArc.to] || "Unknown"

      // Remove birth year from player name if present
      const cleanName = playerName.replace(/\s*$$\d{4}$$$/g, "")
      title.textContent = `${cleanName} (${currentArc.year})`

      const text = playerInfo.querySelector("p")
      if (text) {
        text.textContent = `${fromClub} → ${toClub}`
      }
    }
  }
}

// Function to update player career path
async function updatePlayerCareerPath(year) {
  // This function is no longer needed for the animation
  // but we'll keep it for compatibility
  // The animation is now handled by startPlayerTransferAnimation
}

// Helper function to find country flag URL from country code
function findCountryFlagUrl(countryCode) {
  // First check if the player has this flag in their country_flags property
  if (
    selectedPlayerId &&
    playerDatabase[selectedPlayerId] &&
    playerDatabase[selectedPlayerId].country_flags &&
    playerDatabase[selectedPlayerId].country_flags[countryCode]
  ) {
    const flagUrl = playerDatabase[selectedPlayerId].country_flags[countryCode]
    return flagUrl
  }

  // If not found in player database, try to find it in the country_flags global object
  // Search through all years data to find the flag URL
  for (const year in allYearsData) {
    const data = allYearsData[year]

    // Check if the data has the new structure with "data" property
    if (data.data && data.data.seasons) {
      // Search through each season
      for (const seasonName in data.data.seasons) {
        const season = data.data.seasons[seasonName]

        // Search through each club
        for (const club of season) {
          // Check incoming transfers
          if (club.teams_in) {
            for (const [id, country] of Object.entries(club.teams_in)) {
              if (country_info[id] && country_info[id].code === countryCode && country.logo) {
                return country.logo
              }
            }
          }

          // Check outgoing transfers
          if (club.teams_out) {
            for (const [id, country] of Object.entries(club.teams_out)) {
              if (country_info[id] && country_info[id].code === countryCode && country.logo) {
                return country.logo
              }
            }
          }
        }
      }
    }
  }

  // If no flag URL is found, use a fallback from flagcdn.com
  const fallbackUrl = `https://flagcdn.com/w20/${countryCode.toLowerCase()}.png`
  return fallbackUrl
}

// Function to preload flag images
function preloadFlagImages() {
  // Create a set to store unique flag URLs
  const flagUrls = new Set()

  // Collect flag URLs from player database
  for (const playerId in playerDatabase) {
    const player = playerDatabase[playerId]
    if (player.country_flags) {
      for (const countryCode in player.country_flags) {
        const flagUrl = player.country_flags[countryCode]
        if (flagUrl) {
          flagUrls.add(flagUrl)
        }
      }
    }
  }

  // Preload each flag image
  flagUrls.forEach((url) => {
    const img = new Image()
    img.crossOrigin = "anonymous" // Important for CORS
    img.src = url
  })
}

// Show player info panel
function showPlayerInfo(name) {
  const playerInfo = document.getElementById("player-info")
  if (!playerInfo) return

  const title = playerInfo.querySelector("h3")
  const text = playerInfo.querySelector("p")

  if (title) {
    // Remove birth year from player name if present
    const cleanName = name.replace(/\s*$$\d{4}$$$/g, "")
    title.textContent = cleanName
  }

  // Add country flags if available
  const flagsContainer = playerInfo.querySelector(".country-flags")
  if (flagsContainer) {
    flagsContainer.innerHTML = "" // Clear existing flags

    // First add the origin country of the first transfer
    if (playerCareerArcs.length > 0) {
      const firstTransfer = playerCareerArcs[0]
      const fromCountryCode = firstTransfer.from
      const fromClub = firstTransfer.fromClub || countryCodeToName[firstTransfer.from] || "Unknown"
      const toClub = firstTransfer.toClub || countryCodeToName[firstTransfer.to] || "Unknown"

      // Update the text to show transfer information
      if (text) {
        text.textContent = `${fromClub} → ${toClub}`
      }

      // Update the title to include the year
      if (title) {
        title.textContent = `${name} (${firstTransfer.year})`
      }

      // Get country flags from player database
      if (
        selectedPlayerId &&
        playerDatabase[selectedPlayerId] &&
        playerDatabase[selectedPlayerId].country_flags &&
        playerDatabase[selectedPlayerId].country_flags[fromCountryCode]
      ) {
        const flagUrl = playerDatabase[selectedPlayerId].country_flags[fromCountryCode]
        const flagImg = document.createElement("img")
        flagImg.src = flagUrl
        flagImg.alt = countryCodeToName[fromCountryCode] || fromCountryCode
        flagImg.title = countryCodeToName[fromCountryCode] || fromCountryCode
        flagImg.style.width = "24px"
        flagImg.style.height = "24px"
        flagImg.style.objectFit = "cover"
        flagImg.style.borderRadius = "5px"
        flagImg.style.border = "none"
        flagsContainer.appendChild(flagImg)
      } else {
        // If no flag URL is available, show country code as fallback
        const codeSpan = document.createElement("span")
        codeSpan.textContent = fromCountryCode
        codeSpan.style.display = "inline-block"
        codeSpan.style.padding = "0 5px"
        codeSpan.style.backgroundColor = "#000"
        codeSpan.style.color = "#fff"
        codeSpan.style.fontSize = "10px"
        codeSpan.style.fontWeight = "bold"
        codeSpan.style.borderRadius = "5px"
        codeSpan.title = countryCodeToName[fromCountryCode] || fromCountryCode
        flagsContainer.appendChild(codeSpan)
      }
    }

    // Then add all destination countries in order
    playerCareerArcs.forEach((arc, index) => {
      // Add arrow between flags
      if (index > 0 || playerCareerArcs.length > 0) {
        const arrow = document.createElement("span")
        arrow.innerHTML = "→"
        arrow.style.margin = "0 2px"
        arrow.style.color = "var(--text-color)"
        flagsContainer.appendChild(arrow)
      }

      const toCountryCode = arc.to

      // Get country flags from player database
      if (
        selectedPlayerId &&
        playerDatabase[selectedPlayerId] &&
        playerDatabase[selectedPlayerId].country_flags &&
        playerDatabase[selectedPlayerId].country_flags[toCountryCode]
      ) {
        const flagUrl = playerDatabase[selectedPlayerId].country_flags[toCountryCode]
        const flagImg = document.createElement("img")
        flagImg.src = flagUrl
        flagImg.alt = countryCodeToName[toCountryCode] || toCountryCode
        flagImg.title = countryCodeToName[toCountryCode] || toCountryCode
        flagImg.style.width = "24px"
        flagImg.style.height = "24px"
        flagImg.style.objectFit = "cover"
        flagImg.style.borderRadius = "5px"
        flagImg.style.border = "none"
        flagsContainer.appendChild(flagImg)
      } else {
        // If no flag URL is available, show country code as fallback
        const codeSpan = document.createElement("span")
        codeSpan.textContent = toCountryCode
        codeSpan.style.display = "inline-block"
        codeSpan.style.padding = "0 5px"
        codeSpan.style.backgroundColor = "#000"
        codeSpan.style.color = "#fff"
        codeSpan.style.fontSize = "10px"
        codeSpan.style.fontWeight = "bold"
        codeSpan.style.borderRadius = "5px"
        codeSpan.title = countryCodeToName[toCountryCode] || toCountryCode
        flagsContainer.appendChild(codeSpan)
      }
    })
  }

  playerInfo.style.display = "block"
}

//=============================================================================
// TOOLTIP AND INTERACTION FUNCTIONALITY
//=============================================================================

// Show tooltip with transfer information
function showTooltip(arc, clientX, clientY) {
  const tooltip = document.getElementById("tooltip")
  if (!tooltip) return

  const arcData = arc
  const originCountry = countryCodeToName[arcData.from] || "País Desconhecido"
  const destinationCountry = countryCodeToName[arcData.to] || "País Desconhecido"

  // In player career mode, show simplified tooltip with club and country information
  if (playerCareerMode) {
    // Use the actual player name from the arc's players array if available
    const exactPlayerName = arcData.players && arcData.players.length > 0 ? arcData.players[0] : playerName

    // Get club information
    const fromClub = arcData.fromClub || "Clube Desconhecido"
    const toClub = arcData.toClub || "Clube Desconhecido"

    // Get year information
    const transferYear = arcData.year || "Ano Desconhecido"

    // Format the tooltip with the requested format
    tooltip.innerHTML = `
        <strong>Origem:</strong> ${fromClub} (${originCountry})<br>
        <strong>Destino:</strong> ${toClub} (${destinationCountry})<br>
        <strong>Ano:</strong> ${transferYear}
    `
  } else {
    const playerCount = arcData.count
    const playersList = arcData.players
    const playersDisplay = playersList && playersList.length > 0 ? playersList.join(", ") : "Nenhum jogador disponível"

    tooltip.innerHTML = `
        <strong>Origem:</strong> ${originCountry}<br>
        <strong>Destino:</strong> ${destinationCountry}<br>
        <strong>Jogadores (${playerCount}):</strong> ${playersDisplay}
    `
  }

  tooltip.style.display = "block"
  updateTooltipPosition(clientX, clientY)
}

// Hide tooltip
function hideTooltip() {
  const tooltip = document.getElementById("tooltip")
  if (tooltip) {
    tooltip.style.display = "none"
  }
}

// Update tooltip position
function updateTooltipPosition(clientX, clientY) {
  const tooltip = document.getElementById("tooltip")
  if (!tooltip || tooltip.style.display === "none") return

  const offsetX = 15
  const offsetY = 15

  // Ensure tooltip stays within viewport
  const tooltipWidth = tooltip.offsetWidth || 150
  const tooltipHeight = tooltip.offsetHeight || 80

  const left = Math.min(clientX + offsetX, window.innerWidth - tooltipWidth - 5)
  const top = Math.min(clientY + offsetY, window.innerHeight - tooltipHeight - 5)

  tooltip.style.left = `${left}px`
  tooltip.style.top = `${top}px`
}

// Handle mouse movement for arc hovering
function onMouseMove(event) {
  // Update mouse coordinates
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

  // If no arcs are displayed, exit early
  if (!arcsArray || arcsArray.length === 0) {
    if (hoveredArc) {
      hideTooltip()
      hoveredArc = null
    }
    return
  }

  // Set up raycaster with current mouse position
  raycaster.setFromCamera(mouse, camera)

  let closestArc = null
  let closestDistance = Number.POSITIVE_INFINITY

  // Check each arc
  arcsArray.forEach((arc) => {
    // Skip arcs with missing coordinates
    if (!arc.startLat || !arc.startLng || !arc.endLat || !arc.endLng) {
      return
    }

    try {
      // Generate points along the arc for detection
      const numPoints = 50 // Increased for better detection
      const arcScale = arc.scale || 0.5

      // Create start and end points in 3D space
      const startPoint = new THREE.Vector3().setFromSphericalCoords(
        100,
        ((90 - arc.startLat) * Math.PI) / 180,
        (arc.startLng * Math.PI) / 180,
      )

      const endPoint = new THREE.Vector3().setFromSphericalCoords(
        100,
        ((90 - arc.endLat) * Math.PI) / 180,
        (arc.endLng * Math.PI) / 180,
      )

      // Create a curve between the points
      const curve = new THREE.QuadraticBezierCurve3(
        startPoint,
        new THREE.Vector3()
          .addVectors(startPoint, endPoint)
          .multiplyScalar(0.5)
          .normalize()
          .multiplyScalar(100 * (1 + arcScale * 0.4)),
        endPoint,
      )

      // Get points along the curve
      const arcPoints = curve.getPoints(numPoints)

      // Check each segment of the arc
      let minDistanceToArc = Number.POSITIVE_INFINITY

      for (let i = 0; i < arcPoints.length - 1; i++) {
        const start = arcPoints[i]
        const end = arcPoints[i + 1]

        // Project both points to screen space
        const startScreen = start.clone().project(camera)
        const endScreen = end.clone().project(camera)

        // Convert to screen coordinates
        const startX = (startScreen.x * 0.5 + 0.5) * window.innerWidth
        const startY = (startScreen.y * -0.5 + 0.5) * window.innerHeight
        const endX = (endScreen.x * 0.5 + 0.5) * window.innerWidth
        const endY = (endScreen.y * -0.5 + 0.5) * window.innerHeight

        // Calculate distance from mouse to this line segment in screen space
        const mouseX = event.clientX
        const mouseY = event.clientY

        // Line segment distance calculation in 2D
        const A = mouseX - startX
        const B = mouseY - startY
        const C = endX - startX
        const D = endY - startY

        const dot = A * C + B * D
        const lenSq = C * C + D * D
        let param = -1

        if (lenSq !== 0) {
          param = dot / lenSq
        }

        let xx, yy

        if (param < 0) {
          xx = startX
          yy = startY
        } else if (param > 1) {
          xx = endX
          yy = endY
        } else {
          xx = startX + param * C
          yy = startY + param * D
        }

        const dx = mouseX - xx
        const dy = mouseY - yy
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance < minDistanceToArc) {
          minDistanceToArc = distance
        }
      }

      // If this arc is closer than previous closest, update
      if (minDistanceToArc < closestDistance) {
        closestDistance = minDistanceToArc
        closestArc = arc
      }
    } catch (error) {
      console.error("Error calculating arc points:", error)
    }
  })

  // Threshold for hover detection
  const hoverThreshold = 10 // Increased for better usability

  if (closestArc && closestDistance < hoverThreshold) {
    if (hoveredArc !== closestArc) {
      // Set new hovered arc
      hoveredArc = closestArc

      // Show tooltip
      showTooltip(closestArc, event.clientX, event.clientY)
    } else {
      // Update tooltip position even if the arc hasn't changed
      updateTooltipPosition(event.clientX, event.clientY)
    }
  } else {
    if (hoveredArc !== null) {
      // Hide tooltip
      hideTooltip()
      hoveredArc = null
    }
  }
}

//=============================================================================
// UTILITY FUNCTIONS
//=============================================================================

// Debounce function to limit how often a function is called
function debounce(func, wait) {
  let timeout
  return function (...args) {
    clearTimeout(timeout)
    timeout = setTimeout(() => func.apply(this, args), wait)
  }
}

// Helper function to get country coordinates from country code
function getCountryCoordinatesFromCode(countryCode) {
  // Find the country ID from the code
  const countryId = Object.entries(country_info).find(([id, info]) => info.code === countryCode)?.[0]

  if (countryId) {
    return {
      lat: country_info[countryId].lat,
      lng: country_info[countryId].lng,
    }
  }

  // Fallback: try to find coordinates from the arcs data
  for (const year in allYearsData) {
    const yearData = allYearsData[year]
    if (yearData && yearData.arcs) {
      // Look for arcs that have this country as origin or destination
      const arcWithCountry = yearData.arcs.find((arc) => arc.from === countryCode || arc.to === countryCode)

      if (arcWithCountry) {
        if (arcWithCountry.from === countryCode) {
          return {
            lat: arcWithCountry.startLat,
            lng: arcWithCountry.startLong,
          }
        } else {
          return {
            lat: arcWithCountry.endLat,
            lng: arcWithCountry.endLong,
          }
        }
      }
    }
  }

  return null
}

//=============================================================================
// INITIALIZATION AND EXECUTION
//=============================================================================

// Initialize the application
init()
loadInitialData()
onWindowResize()
animate()