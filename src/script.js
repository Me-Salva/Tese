import * as THREE from "three"
import ThreeGlobe from "three-globe"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

var renderer, camera, scene, controls, mainGlobe, glowGlobe
var countriesData, arcsData
var arcsArray = []
const countryCodeToName = {}
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
let hoveredArc = null
let globeInitialized = false
let isPlaying = false
let animationInterval = null
let currentYear = 1951
const minYear = 1951
const maxYear = 2025

// Player career path tracking
let playerCareerMode = false
let playerCareerArcs = []
let playerName = ""
let firstPlayerTransferYear = null
const allYearsData = {} // Store data for all years to avoid repeated fetching

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

function debounce(func, wait) {
  let timeout
  return function (...args) {
    clearTimeout(timeout)
    timeout = setTimeout(() => func.apply(this, args), wait)
  }
}

init()
loadInitialData()
onWindowResize()
animate()

function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  document.body.appendChild(renderer.domElement)

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xffffff)

  var ambientLight = new THREE.AmbientLight(0xffffff, 1.2)
  scene.add(ambientLight)

  var hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5)
  scene.add(hemisphereLight)

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000)
  camera.position.set(0, 0, 400)
  scene.add(camera)

  var dLight = new THREE.DirectionalLight(0xffffff, 0.8)
  dLight.position.set(-800, 2000, 400)
  scene.add(dLight)

  var dLight1 = new THREE.DirectionalLight(0xffffff, 1)
  dLight1.position.set(-200, 500, 200)
  scene.add(dLight1)

  var dLight2 = new THREE.DirectionalLight(0xffffff, 0.5)
  dLight2.position.set(200, -500, -200)
  scene.add(dLight2)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.enablePan = false
  controls.minDistance = 160
  controls.maxDistance = 300
  controls.autoRotate = false
  controls.minPolarAngle = Math.PI / 4
  controls.maxPolarAngle = Math.PI / 2

  window.addEventListener("resize", onWindowResize, false)

  const selectAllCheckbox = document.getElementById("selectAll")
  selectAllCheckbox.addEventListener("change", toggleAllCountries)

  const continentCheckboxes = document.querySelectorAll(".continent-checkbox")
  continentCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", toggleContinent)
  })

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

  document.addEventListener("DOMContentLoaded", () => {
    const filtersDiv = document.getElementById("filters")
    const toggleButton = document.getElementById("toggle-filters")

    filtersDiv.style.display = "none"
    toggleButton.textContent = "Mostrar Filtros"

    toggleButton.addEventListener("click", () => {
      if (filtersDiv.style.display === "none" || filtersDiv.style.display === "") {
        filtersDiv.style.display = "block"
        toggleButton.textContent = "Esconder Filtros"
      } else {
        filtersDiv.style.display = "none"
        toggleButton.textContent = "Mostrar Filtros"
      }
    })
  })

  window.addEventListener("mousemove", onMouseMove, false)
}

// Setup time controls (play/pause, forward, backward)
function setupTimeControls() {
  const playPauseBtn = document.getElementById("play-pause-btn")
  const forwardBtn = document.getElementById("forward-btn")
  const backwardBtn = document.getElementById("backward-btn")

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
}

// Toggle play/pause state
function togglePlayPause(button) {
  isPlaying = !isPlaying

  if (isPlaying) {
    // Change to pause icon
    button.innerHTML = "&#9616;&#9616;" // Pause icon
    button.classList.add("playing")

    // Start animation
    startYearAnimation()
  } else {
    // Change to play icon
    button.innerHTML = "&#9658;" // Play icon
    button.classList.remove("playing")

    // Stop animation
    stopYearAnimation()
  }
}

// Start year animation
function startYearAnimation() {
  if (animationInterval) {
    clearInterval(animationInterval)
  }

  // Advance year every 2 seconds
  animationInterval = setInterval(() => {
    if (currentYear < maxYear) {
      currentYear++
      updateYearDisplay()
    } else {
      togglePlayPause(document.getElementById("play-pause-btn"))
    }
  }, 2000)
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

// Load initial data and create the globe
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
    })

    // Initialize the globe with countries data
    initGlobe(countriesData)

    // Now load the initial arcs data for the starting year
    currentYear = Number.parseInt(document.getElementById("time-slider").value) || minYear
    document.getElementById("current-year").textContent = currentYear

    await loadArcsForYear(currentYear)

    // Initialize filters after data is loaded
    initializeFilters()
  } catch (error) {
    console.error("Error loading initial data:", error)
  }
}

// Load arcs data for a specific year
async function loadArcsForYear(year) {
  try {
    console.log(`Loading arcs for year: ${year}`)

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

    // Process the arcs
    const arcsDataWithThickness = arcsData.arcs.map((arc) => ({
      startLat: arc.startLat,
      startLng: arc.startLong,
      endLat: arc.endLat,
      endLng: arc.endLong,
      color: arc.color,
      from: arc.from,
      to: arc.to,
      count: arc.count,
      players: arc.players,
    }))

    // If filters have been applied, reapply them to the new data
    if (currentFilterState.filtersApplied) {
      applyCurrentFilters()
    } else {
      // Otherwise, just show all arcs
      updateArcs(arcsDataWithThickness)
    }
  } catch (error) {
    console.error(`Error loading arcs for year ${year}:`, error)
  }
}

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

function updateSelectAllCheckbox() {
  const countryCheckboxes = document.querySelectorAll('input[name="country"]')
  const selectAllCheckbox = document.getElementById("selectAll")

  const allChecked = Array.from(countryCheckboxes).every((checkbox) => checkbox.checked)
  selectAllCheckbox.checked = allChecked
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
        // If arc is from source to destination, color it red (outgoing from source)
        // If arc is from destination to source, color it green (incoming to source)
        const isOutgoingFromSource = arc.from === currentFilterState.sourceCountryCode
        const color = isOutgoingFromSource ? "#FF0000" : "#00FF00"

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
      const color = isIncoming ? "#00FF00" : "#FF0000"

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
    color: arc.color || "#FF0000",
    from: arc.from,
    to: arc.to,
    count: arc.count,
    scale: arc.scale !== undefined ? arc.scale : arc.color === "#00FF00" ? 0.3 : 0.5,
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

  // If no countries are selected and no other filters are active, show nothing
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

function createCountryBorders(countries) {
  const borderMaterial = new THREE.LineBasicMaterial({ color: "#d6dbdf", linewidth: 1 })
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

function initGlobe(countries) {
  if (globeInitialized) return // Only initialize once

  console.log("Initializing globe")

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
    .arcsTransitionDuration(1000)

  const globeMaterial = mainGlobe.globeMaterial()
  globeMaterial.emissive = new THREE.Color("#f8f9f9")
  globeMaterial.emissiveIntensity = 0.2
  globeMaterial.shininess = 0.8

  mainGlobe.scale.set(100, 100, 100)
  scene.add(mainGlobe)

  const borders = createCountryBorders(countries)
  scene.add(borders)

  globeInitialized = true
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

    const { r, g, b } = hexToRgb(arc.color || "#FF0000")

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

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

function animate() {
  controls.update()
  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}

function latLonToVector3(lat, lon, radius = 100) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 90) * (Math.PI / 180)

  const x = -radius * Math.sin(phi) * Math.cos(theta)
  const y = radius * Math.cos(phi)
  const z = radius * Math.sin(phi) * Math.sin(theta)

  return new THREE.Vector3(x, y, z)
}

// Generate points along an arc path with proper altitude
function generateArcPoints(startLat, startLng, endLat, endLng, scale, numPoints = 30) {
  const points = []
  const start = latLonToVector3(startLat, startLng, 100)
  const end = latLonToVector3(endLat, endLng, 100)

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints
    // Create a point along the arc
    const point = new THREE.Vector3().lerpVectors(start, end, t)

    // Apply altitude curve to the point
    const altitude = scale || 0.5
    const altitudeFactor = Math.sin(t * Math.PI) * altitude
    const elevated = point
      .clone()
      .normalize()
      .multiplyScalar(100 * (1 + altitudeFactor * 0.4))

    points.push(elevated)
  }

  return points
}

function onMouseMove(event) {
  // Update mouse coordinates
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

  raycaster.setFromCamera(mouse, camera)

  let closestArc = null
  let closestDistance = Number.POSITIVE_INFINITY

  if (!arcsArray || arcsArray.length === 0) return

  // Check each arc
  arcsArray.forEach((arc) => {
    // Generate more points along the arc for better detection
    const arcPoints = generateArcPoints(
      arc.startLat,
      arc.startLng,
      arc.endLat,
      arc.endLng,
      arc.scale,
      50, // Increased number of points for better detection
    )

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
  })

  // Threshold for hover detection - increased for better usability
  const hoverThreshold = 20 // Increased threshold

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

// Add this new function to update tooltip position without changing content
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

// Fix the updatePlayerCareerPath function to properly show new arcs as years advance
// and improve player name matching to handle players with the same name

// Replace the updatePlayerCareerPath function with this improved version
// that ensures all arcs from all years are properly displayed

function updatePlayerCareerPath(year) {
  if (!playerCareerMode || !playerName) return

  console.log(`Updating player career path for ${playerName} up to year ${year}`)

  // Get all arcs up to the current year
  const allArcs = []

  // Process each year from the first transfer to the current year
  for (let y = firstPlayerTransferYear; y <= year; y++) {
    if (allYearsData[y]) {
      const playerNameLower = playerName.toLowerCase()

      // Filter arcs for this player in this year
      const yearArcs = allYearsData[y].arcs.filter(
        (arc) => arc.players && arc.players.some((player) => player.toLowerCase().includes(playerNameLower)),
      )

      console.log(`Found ${yearArcs.length} arcs for ${playerName} in year ${y}`)

      // Process the arcs for display
      const processedArcs = yearArcs.map((arc) => {
        // Filter the players array to only include the matching player(s)
        const matchingPlayers = arc.players.filter((player) => player.toLowerCase().includes(playerNameLower))

        return {
          startLat: arc.startLat,
          startLng: arc.startLong,
          endLat: arc.endLat,
          endLng: arc.endLong,
          color: "#4169E1", // Royal Blue for player career
          from: arc.from,
          to: arc.to,
          count: 1, // Always 1 for a single player
          players: matchingPlayers,
          year: y, // Add year information
          stroke: 0.2, // Fixed stroke for player transfers
        }
      })

      allArcs.push(...processedArcs)
    }
  }

  console.log(`Total arcs for player career path: ${allArcs.length}`)

  // Update the visualization with all arcs
  if (allArcs.length > 0) {
    // Store the career arcs for this player
    playerCareerArcs = allArcs

    // Update the visualization with all arcs at once
    const arcsWithThickness = allArcs.map((arc) => ({
      ...arc,
      stroke: 0.2, // Fixed stroke for player transfers
    }))

    // Create glow effect
    const glowArcs = allArcs.map((arc) => {
      const hexToRgb = (hex) => {
        const r = Number.parseInt(hex.slice(1, 3), 16)
        const g = Number.parseInt(hex.slice(3, 5), 16)
        const b = Number.parseInt(hex.slice(5, 7), 16)
        return { r, g, b }
      }

      const { r, g, b } = hexToRgb(arc.color)

      return {
        ...arc,
        stroke: 0.25, // Slightly thicker for glow
        color: `rgba(${r}, ${g}, ${b}, 0.25)`,
      }
    })

    // Update both globes with all arcs
    mainGlobe.arcsData(arcsWithThickness)
    glowGlobe.arcsData(glowArcs)
    arcsArray = arcsWithThickness
  } else {
    // No arcs found for this player
    mainGlobe.arcsData([])
    glowGlobe.arcsData([])
    arcsArray = []
  }
}

// Also update the findFirstPlayerTransferYear function to use the same matching logic
async function findFirstPlayerTransferYear() {
  const playerNameLower = playerName.toLowerCase()

  // Search through all years
  for (let year = minYear; year <= maxYear; year++) {
    try {
      // Load data for this year if not already loaded
      if (!allYearsData[year]) {
        const linesResponse = await fetch(`./files/arcs/lines_${year}.json`)
        const yearData = await linesResponse.json()
        allYearsData[year] = yearData
      }

      // Check if any arc contains this player with more precise matching
      const playerArcs = allYearsData[year].arcs.filter(
        (arc) =>
          arc.players &&
          arc.players.some(
            (player) =>
              player.toLowerCase() === playerNameLower ||
              (player.toLowerCase().includes(playerNameLower) &&
                (player.toLowerCase().startsWith(playerNameLower) ||
                  player.toLowerCase().includes(" " + playerNameLower))),
          ),
      )

      if (playerArcs.length > 0) {
        firstPlayerTransferYear = year
        return
      }
    } catch (error) {
      console.error(`Error checking year ${year} for player ${playerName}:`, error)
    }
  }
}

// Add a new function to preload all years data
async function preloadAllYearsData() {
  console.log("Preloading all years data...")

  // Create an array of promises for loading all years
  const loadPromises = []

  for (let year = minYear; year <= maxYear; year++) {
    if (!allYearsData[year]) {
      const promise = fetch(`./files/arcs/lines_${year}.json`)
        .then((response) => response.json())
        .then((data) => {
          allYearsData[year] = data
          console.log(`Loaded data for year ${year}`)
        })
        .catch((error) => {
          console.error(`Error loading data for year ${year}:`, error)
        })

      loadPromises.push(promise)
    }
  }

  // Wait for all data to be loaded
  await Promise.all(loadPromises)
  console.log("All years data preloaded")
}

// Update the showTooltip function to show more detailed information
function showTooltip(arc, clientX, clientY) {
  const tooltip = document.getElementById("tooltip")
  if (!tooltip) return

  const arcData = arc
  const originCountry = countryCodeToName[arcData.from] || "País Desconhecido"
  const destinationCountry = countryCodeToName[arcData.to] || "País Desconhecido"

  // In player career mode, show simplified tooltip with count=1 and exact player name
  if (playerCareerMode) {
    // Use the actual player name from the arc's players array if available
    const exactPlayerName = arcData.players && arcData.players.length > 0 ? arcData.players[0] : playerName

    // Add year information if available
    const yearInfo = arcData.year ? ` (${arcData.year})` : ""

    tooltip.innerHTML = `
        <strong>Origem:</strong> ${originCountry}<br>
        <strong>Destino:</strong> ${destinationCountry}<br>
        <strong>Jogador:</strong> ${exactPlayerName}${yearInfo}
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

// Initialize advanced filters
function initAdvancedFilters() {
  // Populate country dropdowns
  populateCountryDropdowns()

  // Set up toggle functionality for advanced filter sections
  setupFilterToggles()

  // Set up event listeners for advanced filter buttons
  if (document.getElementById("applyCountryFilter")) {
    document.getElementById("applyCountryFilter").addEventListener("click", applyCountryToCountryFilter)
  }

  if (document.getElementById("resetCountryFilter")) {
    document.getElementById("resetCountryFilter").addEventListener("click", resetCountryToCountryFilter)
  }

  if (document.getElementById("applyPlayerFilter")) {
    document.getElementById("applyPlayerFilter").addEventListener("click", applyPlayerCareerFilter)
  }

  if (document.getElementById("resetPlayerFilter")) {
    document.getElementById("resetPlayerFilter").addEventListener("click", resetPlayerFilter)
  }

  if (document.getElementById("resetAllFilters")) {
    document.getElementById("resetAllFilters").addEventListener("click", resetAllFilters)
  }
}

// Populate country dropdowns with all available countries
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
}

// Set up toggle functionality for advanced filter sections
function setupFilterToggles() {
  const toggles = document.querySelectorAll(".filter-toggle")

  toggles.forEach((toggle) => {
    toggle.addEventListener("click", function () {
      this.classList.toggle("open")

      // Get the corresponding content element
      const contentId = this.id.replace("toggle-", "") + "-content"
      const content = document.getElementById(contentId)

      if (content) {
        content.classList.toggle("open")
      }
    })
  })
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
    alert("Por favor, selecione pelo menos um país de origem ou destino.")
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

  // Apply the filters
  applyCurrentFilters()
}

// Apply player career filter
async function applyPlayerCareerFilter() {
  const playerNameInput = document.getElementById("playerName")
  if (!playerNameInput) return

  const inputPlayerName = playerNameInput.value.trim()

  if (!inputPlayerName) {
    alert("Por favor, digite o nome de um jogador.")
    return
  }

  // Set player name and enter career mode
  playerName = inputPlayerName
  playerCareerMode = true
  playerCareerArcs = []
  firstPlayerTransferYear = null

  // Preload all years data to find all player transfers
  await preloadAllYearsData()

  // Find the first year with a transfer for this player
  await findFirstPlayerTransferYear()

  if (firstPlayerTransferYear) {
    // Update the year slider to the first transfer year
    currentYear = firstPlayerTransferYear
    const timeSlider = document.getElementById("time-slider")
    timeSlider.value = currentYear
    document.getElementById("current-year").textContent = currentYear

    // Start building the career path
    updatePlayerCareerPath(currentYear)
  } else {
    alert(`Nenhuma transferência encontrada para ${playerName}.`)
    exitPlayerCareerMode()
  }
}

// Exit player career mode
function exitPlayerCareerMode() {
  playerCareerMode = false
  playerCareerArcs = []
  playerName = ""
  firstPlayerTransferYear = null

  // Reset the player name input
  const playerNameInput = document.getElementById("playerName")
  if (playerNameInput) playerNameInput.value = ""

  // Load regular arcs for the current year
  loadArcsForYear(currentYear)
}

// Reset player filter
function resetPlayerFilter() {
  // Exit player career mode if active
  if (playerCareerMode) {
    exitPlayerCareerMode()
  }

  const playerNameInput = document.getElementById("playerName")
  if (playerNameInput) playerNameInput.value = ""

  // Update current filter state
  currentFilterState = {
    ...currentFilterState,
    playerName: null,
    playerFilterActive: false,
  }

  // Apply the filters
  applyCurrentFilters()
}

// Reset all filters
function resetAllFilters() {
  // Exit player career mode if active
  if (playerCareerMode) {
    exitPlayerCareerMode()
  }

  // Reset country checkboxes
  const countryCheckboxes = document.querySelectorAll('input[name="country"]')
  countryCheckboxes.forEach((checkbox) => {
    checkbox.checked = true
  })

  // Reset continent checkboxes
  const continentCheckboxes = document.querySelectorAll(".continent-checkbox")
  continentCheckboxes.forEach((checkbox) => {
    checkbox.checked = true
  })

  // Reset select all checkbox
  const selectAllCheckbox = document.getElementById("selectAll")
  if (selectAllCheckbox) selectAllCheckbox.checked = true

  // Reset transfer direction checkboxes
  const transferInCheckbox = document.getElementById("showTransfersIn")
  const transferOutCheckbox = document.getElementById("showTransfersOut")
  const showAllTransfersCheckbox = document.getElementById("showAllTransfers")

  if (transferInCheckbox) transferInCheckbox.checked = true
  if (transferOutCheckbox) transferOutCheckbox.checked = true
  if (showAllTransfersCheckbox) showAllTransfersCheckbox.checked = true

  // Reset advanced filters
  resetCountryToCountryFilter()
  resetPlayerFilter()

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

  // Apply the reset filters
  applyCurrentFilters()
}

// Setup auto filtering for all checkboxes
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
      if (transferInCheckbox && transferOutCheckbox.checked && transferInCheckbox.checked) {
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
}

// Initialize all filters
function initializeFilters() {
  initAdvancedFilters()
  setupAutoFiltering()
}

function hideTooltip() {
  const tooltip = document.getElementById("tooltip")
  if (tooltip) {
    tooltip.style.display = "none"
  }
}

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