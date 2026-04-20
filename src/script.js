/**
 * ==========================================
 * Scripts - Tela de Amsler Responsiva
 * ==========================================
 */

// Define global variables
let isMouseDown = false;
let eraseMode = false;
let zoomLevel = 1;
let rainMode = false;
let rainInterval;
let keyboardMoveInterval;
let isKeyboardPaintDown = false;
const keyboardModifierState = {
  ctrlPressed: false,
  shiftPressed: false,
  altPressed: false,
};
const activeArrowKeys = new Set();
const timeoutDuration = 60000;
const arrowKeys = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

/* ----------------------
 * Keyboard Navigation
 * ---------------------- */

/**
 * Returns grid dimensions and a static list of cells.
 *
 * @returns {{columns: number, rows: number, cells: HTMLElement[]}}
 */
function getGridMetrics() {
  const grid = document.getElementById("grid");
  const columns = parseInt(getComputedStyle(grid).gridTemplateColumns.split(" ").length);
  const rows = parseInt(getComputedStyle(grid).gridTemplateRows.split(" ").length);
  const cells = Array.from(grid.children);

  return { columns, rows, cells };
}

/**
 * Sets the current keyboard hover cell.
 *
 * @param {HTMLElement} targetCell - The cell to highlight as keyboard hover.
 */
function setKeyboardHoverCell(targetCell) {
  if (!targetCell) return;

  const currentKeyboardHover = document.querySelector(".grid-cell.keyboard-hover");
  if (currentKeyboardHover) {
    currentKeyboardHover.classList.remove("keyboard-hover");
  }

  targetCell.classList.add("keyboard-hover");
}

/**
 * Ensures a keyboard hover cell exists after grid redraws.
 */
function ensureKeyboardHoverCell() {
  const existing = document.querySelector(".grid-cell.keyboard-hover");
  if (existing) return;

  const centerCell = document.querySelector(".center-dot");
  if (centerCell) {
    centerCell.classList.add("keyboard-hover");
    return;
  }

  const firstCell = document.querySelector(".grid-cell");
  if (firstCell) {
    firstCell.classList.add("keyboard-hover");
  }
}

/**
 * Returns the current keyboard-hover target.
 *
 * @returns {HTMLElement|null}
 */
function getKeyboardHoverCell() {
  return document.querySelector(".grid-cell.keyboard-hover") || document.querySelector(".center-dot") || null;
}

/**
 * Computes movement delta from currently pressed arrow keys.
 *
 * @returns {{dx: number, dy: number}}
 */
function getArrowMovementDelta() {
  const dx = (activeArrowKeys.has("ArrowRight") ? 1 : 0) - (activeArrowKeys.has("ArrowLeft") ? 1 : 0);
  const dy = (activeArrowKeys.has("ArrowDown") ? 1 : 0) - (activeArrowKeys.has("ArrowUp") ? 1 : 0);

  return { dx, dy };
}

/**
 * Moves keyboard hover by one step and clamps at grid bounds.
 *
 * @param {number} dx - Horizontal delta (-1, 0, 1).
 * @param {number} dy - Vertical delta (-1, 0, 1).
 */
function moveKeyboardHover(dx, dy) {
  if (dx === 0 && dy === 0) return;

  const { columns, rows, cells } = getGridMetrics();
  if (!columns || !rows || cells.length === 0) return;

  const currentCell = getKeyboardHoverCell() || cells[0];

  const currentIndex = cells.indexOf(currentCell);
  if (currentIndex === -1) return;

  const currentCol = currentIndex % columns;
  const currentRow = Math.floor(currentIndex / columns);

  const nextCol = Math.max(0, Math.min(columns - 1, currentCol + dx));
  const nextRow = Math.max(0, Math.min(rows - 1, currentRow + dy));
  const nextIndex = nextRow * columns + nextCol;

  setKeyboardHoverCell(cells[nextIndex]);
}

/**
 * Starts continuous keyboard hover movement while arrows are held.
 */
function startKeyboardMoveLoop() {
  if (keyboardMoveInterval) return;

  keyboardMoveInterval = setInterval(() => {
    const { dx, dy } = getArrowMovementDelta();
    if (dx === 0 && dy === 0) {
      clearInterval(keyboardMoveInterval);
      keyboardMoveInterval = null;
      return;
    }

    moveKeyboardHover(dx, dy);

    if (isKeyboardPaintDown) {
      paintKeyboardHoverCell(getPaintOptionsFromKeyboardState());
    }
  }, 70);
}

/**
 * Stops continuous keyboard hover movement.
 */
function stopKeyboardMoveLoop() {
  clearInterval(keyboardMoveInterval);
  keyboardMoveInterval = null;
}

/* ----------------------
 * Grid Drawing
 * ---------------------- */

/**
 * Draws the grid dynamically based on the window size.
 * It creates a grid of cells that can be colored, blinked, or erased.
 * The grid adjusts to the window size and maintains a center dot.
 */
function drawGrid() {
  const grid = document.getElementById("grid");

  // Save current colored cell state to reapply after resize
  const oldCells = Array.from(grid.children);
  const oldState = oldCells.map((cell) => ({
    colorMode: cell.classList.contains("colored-green") ? "green" : cell.classList.contains("colored") ? "red" : null,
    isBlinking: cell.classList.contains("blink-animation"), // Save blink state
    isCenterDot: cell.classList.contains("center-dot"),
  }));

  grid.innerHTML = "";
  const cellSize = 20;
  const columns = Math.floor(window.innerWidth / cellSize);
  const rows = Math.floor(window.innerHeight / cellSize);
  const totalCells = columns * rows;

  grid.style.gridTemplateColumns = `repeat(${columns}, ${cellSize}px)`;
  grid.style.gridTemplateRows = `repeat(${rows}, ${cellSize}px)`;

  let currentCenterDotIndex = -1;
  // Check if there was a custom center dot in the old grid
  for (let i = 0; i < oldState.length; i++) {
    if (oldState[i].isCenterDot) {
      // Recalculate its position based on new grid dimensions if possible
      const oldCol = i % (oldCells[0] ? Math.floor(window.innerWidth / cellSize) : columns); // Handle initial load
      const oldRow = Math.floor(i / (oldCells[0] ? Math.floor(window.innerWidth / cellSize) : columns));

      if (oldCol < columns && oldRow < rows) {
        currentCenterDotIndex = oldRow * columns + oldCol;
      }
      break;
    }
  }

  for (let i = 0; i < totalCells; i++) {
    const cell = document.createElement("div");
    cell.className = "grid-cell";

    // Reapply old state if it exists for the current cell
    if (oldState[i]) {
      if (oldState[i].colorMode) {
        setCellColorMode(cell, oldState[i].colorMode);
      }
      if (oldState[i].isBlinking) {
        // Reapply blink state
        cell.classList.add("blink-animation");
      }
    }

    bindGridCellInteractions(cell);

    grid.appendChild(cell);
  }

  // Mark the center dot
  if (currentCenterDotIndex === -1) {
    // If no custom center dot was found or it was out of bounds, use default
    const centerCol = Math.floor(columns / 2);
    const centerRow = Math.floor(rows / 2);
    currentCenterDotIndex = centerRow * columns + centerCol;
  }

  if (grid.children[currentCenterDotIndex]) {
    grid.children[currentCenterDotIndex].classList.add("center-dot");
  }

  ensureKeyboardHoverCell();
}

/**
 * Draws a fixed-size grid with specified columns and rows.
 * This is useful for scenarios where the grid size should not change with window resizing.
 * It also maintains a center dot and allows for coloring, blinking, and erasing cells.
 *
 * @param {number} columns - The number of columns in the grid.
 * @param {number} rows - The number of rows in the grid.
 */
function drawGridFixed(columns, rows) {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  const cellSize = 20;
  grid.style.gridTemplateColumns = `repeat(${columns}, ${cellSize}px)`;
  grid.style.gridTemplateRows = `repeat(${rows}, ${cellSize}px)`;

  for (let i = 0; i < columns * rows; i++) {
    const cell = document.createElement("div");
    cell.className = "grid-cell";

    bindGridCellInteractions(cell);

    grid.appendChild(cell);
  }

  // Mark the default center dot initially
  const centerCol = Math.floor(columns / 2);
  const centerRow = Math.floor(rows / 2);
  const centerIndex = centerRow * columns + centerCol;
  if (grid.children[centerIndex]) {
    grid.children[centerIndex].classList.add("center-dot");
  }

  ensureKeyboardHoverCell();
}

/**
 * Resets the grid to its initial state.
 */
function resetGrid() {
  // Prompt the user for confirmation
  if (!confirm("Tem certeza de que deseja resetar a grade?")) {
    return;
  }

  // Remove all body attributes related to the grid
  document.body.removeAttribute("data-cell-color");
  document.body.removeAttribute("data-line-color");
  document.body.removeAttribute("style");
  document.body.classList.remove("dark");
  wrapper.removeAttribute("style");

  // Remove all grid cells
  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  drawGrid();
}

/* ----------------------
 * Grid Colors
 * ---------------------- */

/**
 * Applies a custom cell color to the grid.
 *
 * @param {string} color - The cell color to apply (e.g., "red").
 */
function applyCellColor(color) {
  if (color) {
    document.body.style.setProperty("--cell-color", color);
    document.body.dataset.cellColor = color;
  } else {
    document.body.style.removeProperty("--cell-color");
    delete document.body.dataset.cellColor;
  }
}

/**
 * Applies a custom line color to the grid.
 *
 * @param {string} color - The line color to apply (e.g., "red").
 */
function applyLineColor(color) {
  if (color) {
    document.body.style.setProperty("--line-color", color);
    document.body.dataset.lineColor = color;
  } else {
    document.body.style.removeProperty("--line-color");
    delete document.body.dataset.lineColor;
  }
}

/**
 * Returns the drawing color mode for a cell.
 *
 * @param {HTMLElement} cell - The grid cell to inspect.
 * @returns {string|null} - "red", "green", or null.
 */
function getCellColorMode(cell) {
  if (cell?.classList.contains("colored-green")) {
    return "green";
  }

  if (cell?.classList.contains("colored")) {
    return "red";
  }

  return null;
}

/**
 * Applies a drawing color mode to a cell.
 *
 * @param {HTMLElement} cell - The grid cell to update.
 * @param {string|null} colorMode - "red", "green", or null.
 */
function setCellColorMode(cell, colorMode) {
  cell.classList.remove("colored", "colored-green");

  if (colorMode === "green") {
    cell.classList.add("colored", "colored-green");
  } else if (colorMode === "red") {
    cell.classList.add("colored");
  }
}

/**
 * Clears any drawing color from a cell.
 *
 * @param {HTMLElement} cell - The grid cell to clear.
 */
function clearCellColor(cell) {
  cell.classList.remove("colored", "colored-green");
}

/**
 * Converts event modifier keys to paint options.
 *
 * @param {KeyboardEvent|MouseEvent|TouchEvent} event - Source event.
 * @param {boolean} erase - Whether erase mode is enabled.
 * @returns {{ctrlPressed: boolean, shiftPressed: boolean, altPressed: boolean, erase: boolean}}
 */
function getPaintOptionsFromInput(event, erase = false) {
  return {
    ctrlPressed: Boolean(event.ctrlKey),
    shiftPressed: Boolean(event.shiftKey),
    altPressed: Boolean(event.altKey),
    erase,
  };
}

/**
 * Syncs keyboard modifier state from an event.
 *
 * @param {KeyboardEvent} event - Keyboard event with modifier flags.
 */
function syncKeyboardModifierState(event) {
  keyboardModifierState.ctrlPressed = Boolean(event.ctrlKey);
  keyboardModifierState.shiftPressed = Boolean(event.shiftKey);
  keyboardModifierState.altPressed = Boolean(event.altKey);
}

/**
 * Returns paint options from currently held keyboard modifiers.
 *
 * @returns {{ctrlPressed: boolean, shiftPressed: boolean, altPressed: boolean, erase: boolean}}
 */
function getPaintOptionsFromKeyboardState() {
  return {
    ctrlPressed: keyboardModifierState.ctrlPressed,
    shiftPressed: keyboardModifierState.shiftPressed,
    altPressed: keyboardModifierState.altPressed,
    erase: false,
  };
}

/**
 * Clears all drawn and blinking cells.
 */
function clearPaintedCells() {
  document
    .querySelectorAll(".grid-cell.colored, .grid-cell.colored-green, .grid-cell.blink-animation")
    .forEach((cell) => {
      clearCellColor(cell);
      cell.classList.remove("blink-animation");
    });
}

/* ----------------------
 * Grid Interactions
 * ---------------------- */

/**
 * Paints a cell based on the current mode (coloring, blinking, erasing).
 *
 * @param {HTMLElement} cell - The grid cell to paint.
 * @param {{ctrlPressed?: boolean, shiftPressed?: boolean, altPressed?: boolean, erase?: boolean}} paintOptions
 */
function paintCell(cell, paintOptions = {}) {
  const { ctrlPressed = false, shiftPressed = false, altPressed = false, erase = false } = paintOptions;

  if (ctrlPressed) {
    moveCenterDot(cell);
  } else if (shiftPressed && altPressed) {
    setCellColorMode(cell, "green");
    cell.classList.toggle("blink-animation");
  } else if (shiftPressed) {
    cell.classList.toggle("blink-animation");
  } else if (erase) {
    clearCellColor(cell);
    cell.classList.remove("blink-animation"); // Stop blinking when erased
  } else if (altPressed) {
    setCellColorMode(cell, "green");
  } else {
    setCellColorMode(cell, "red");
  }
}

/**
 * Paints the currently keyboard-hovered cell.
 *
 * @param {{ctrlPressed?: boolean, shiftPressed?: boolean, altPressed?: boolean, erase?: boolean}} paintOptions
 */
function paintKeyboardHoverCell(paintOptions = {}) {
  const cell = getKeyboardHoverCell();
  if (!cell) return;
  paintCell(cell, paintOptions);
}

/**
 * Binds pointer and touch interaction handlers to one grid cell.
 *
 * @param {HTMLElement} cell - The grid cell to bind interactions for.
 */
function bindGridCellInteractions(cell) {
  cell.addEventListener("mousedown", (event) => {
    event.preventDefault();
    isMouseDown = true;
    eraseMode = event.button === 2; // Right-click for erase
    paintCell(cell, getPaintOptionsFromInput(event, eraseMode));
  });

  cell.addEventListener("mouseover", (event) => {
    if (!isMouseDown) return;
    paintCell(cell, getPaintOptionsFromInput(event, eraseMode));
  });

  cell.addEventListener("touchstart", (event) => {
    event.preventDefault();
    paintCell(cell, getPaintOptionsFromInput(event, false));
  });
}

/**
 * Handles adding or removing a note from a grid cell.
 *
 * @param {HTMLElement} cell - The grid cell to add the note to.
 * @param {string} note - The note text to add.
 */
function handleCellNote(cell, note) {
  // Create a note element
  const noteElement = document.createElement("div");
  noteElement.className = "cell-note";
  noteElement.textContent = note;

  // Remove any previous note elements
  cell.querySelector(".cell-note")?.remove();
  cell.classList.remove("has-note");

  // No note to add
  if (!note) {
    return;
  }

  // Append the note to the cell
  cell.appendChild(noteElement);
  cell.classList.add("has-note");
}

/**
 * Moves the center dot to a new cell.
 * It removes the current center dot class from any existing cell and adds it to the new cell.
 *
 * @param {HTMLElement} newCenterCell - The cell to become the new center dot.
 */
function moveCenterDot(newCenterCell) {
  const currentCenter = document.querySelector(".center-dot");
  if (currentCenter) {
    currentCenter.classList.remove("center-dot");
  }
  newCenterCell.classList.add("center-dot");
}

/* ----------------------
 * Grid Export and Import
 * ---------------------- */

/**
 * Generates a string representation of the grid data.
 * This string includes the grid size, colored ranges, blinking cells, and any custom center dot position.
 * It also compress and encodes the string in base64 for easier sharing.
 *
 * @param {number} columns - The number of columns in the grid.
 * @param {number} rows - The number of rows in the grid.
 * @returns {string} - The compressed string representation of the grid data.
 */
function getGridDataString(columns, rows) {
  const grid = document.getElementById("grid");
  const cells = grid.children;
  let output = `W[${columns}x${rows}]`;

  const currentCenterDot = document.querySelector(".center-dot");
  if (currentCenterDot) {
    const index = Array.from(cells).indexOf(currentCenterDot);
    const centerCol = index % columns;
    const centerRow = Math.floor(index / columns);
    // Only add if it's not the default center
    if (centerCol !== Math.floor(columns / 2) || centerRow !== Math.floor(rows / 2)) {
      output += `C[${centerRow + 1},${centerCol + 1}]`;
    }
  }

  for (let row = 0; row < rows; row++) {
    let rowRedRanges = [];
    let rowGreenRanges = [];
    let rowBlinks = [];
    let currentRedRangeStart = null;
    let currentGreenRangeStart = null;

    for (let col = 0; col < columns; col++) {
      const index = row * columns + col;
      const cell = cells[index];
      const colorMode = getCellColorMode(cell);
      const isBlinking = cell?.classList.contains("blink-animation");
      const isRed = colorMode === "red";
      const isGreen = colorMode === "green";

      if (isRed && currentRedRangeStart === null) {
        currentRedRangeStart = col + 1;
      } else if (!isRed && currentRedRangeStart !== null) {
        rowRedRanges.push(`[${currentRedRangeStart}-${col}]`);
        currentRedRangeStart = null;
      }

      if (isGreen && currentGreenRangeStart === null) {
        currentGreenRangeStart = col + 1;
      } else if (!isGreen && currentGreenRangeStart !== null) {
        rowGreenRanges.push(`G[${currentGreenRangeStart}-${col}]`);
        currentGreenRangeStart = null;
      }

      if (isBlinking) {
        rowBlinks.push(col + 1); // Store just the column number
      }
    }

    if (currentRedRangeStart !== null) {
      rowRedRanges.push(`[${currentRedRangeStart}-${columns}]`); // Close any open range at the end of the row
    }

    if (currentGreenRangeStart !== null) {
      rowGreenRanges.push(`G[${currentGreenRangeStart}-${columns}]`); // Close any open green range at the end of the row
    }

    if (rowRedRanges.length > 0 || rowGreenRanges.length > 0 || rowBlinks.length > 0) {
      let rowSegment = `R${row + 1}`;
      if (rowRedRanges.length > 0) {
        rowSegment += rowRedRanges.join("");
      }
      if (rowGreenRanges.length > 0) {
        rowSegment += rowGreenRanges.join("");
      }
      if (rowBlinks.length > 0) {
        rowSegment += `BR[${rowBlinks.join(",")}]`; // New BR token
      }
      output += rowSegment;
    }
  }

  // Add theme and orientation to the encoded string
  const isDark = document.body.classList.contains("dark");
  const isGridX = document.body.classList.contains("grid-x");
  const isGridY = document.body.classList.contains("grid-y");

  if (isDark) output += "T[D]"; // Dark theme
  if (isGridX) output += "O[X]"; // Grid X orientation
  if (isGridY) output += "O[Y]"; // Grid Y orientation

  // Add zoom level
  const zoomLevel = document.body.dataset.gridZoom || "";
  if (zoomLevel) {
    output += `Z[${zoomLevel}]`;
  }

  // Add custom colors
  const lineColor = document.body.dataset.lineColor || "";
  const cellColor = document.body.dataset.cellColor || "";
  if (lineColor || cellColor) {
    output += `CC[${lineColor}|${cellColor}]`;
  }

  // Add notes
  const notes = [];
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const noteEl = cell.querySelector(".cell-note");
    if (noteEl) {
      const row = Math.floor(i / columns) + 1;
      const col = (i % columns) + 1;
      const note = noteEl.textContent.replace(/[\[\]\|]/g, ""); // sanitize
      notes.push(`N[${row},${col}|${note}]`);
    }
  }

  if (notes.length > 0) {
    output += notes.join(""); // Append all notes
  }

  return compressGridData(output); // compressed + encoded
}

/**
 * Setup the grid data from a compressed string.
 * It decodes the string, extracts grid size, theme, orientation, and cell data,
 * and then draws the grid with the specified parameters.
 *
 * @param {string} encodedData - The compressed string representing the grid data.
 */
function setGridDataFromString(encodedData) {
  let decoded;

  try {
    // Attempt to decompress the data
    decoded = decompressGridData(encodedData);
  } catch (error) {
    // Fallback for old non-compressed data
    decoded = atob(encodedData);
  }

  // If no grid data was found, bail out
  if (!decoded) return;

  const grid = document.getElementById("grid");

  const sizeMatch = decoded.match(/^W\[(\d+)x(\d+)\]/);
  if (!sizeMatch) return;
  const columns = parseInt(sizeMatch[1]);
  const rows = parseInt(sizeMatch[2]);

  drawGridFixed(columns, rows); // create grid with fixed size

  const cells = grid.children;
  // Extract grid data, excluding size, theme, and orientation info
  let data = decoded.slice(sizeMatch[0].length);

  // Check for theme and apply
  const themeMatch = data.match(/T\[(D)\]/);
  if (themeMatch && themeMatch[1] === "D") {
    document.body.classList.add("dark");
    data = data.replace(themeMatch[0], ""); // Remove theme info from data
  }

  // Check for zoom level
  const zoomMatch = data.match(/Z\[(.*?)\]/);
  if (zoomMatch) {
    const zoomLevel = parseFloat(zoomMatch[1]);
    adjustZoom(zoomLevel, 0); // Set 0 as setBaseZoomLevel so the full delta is applied
  }

  // Check for custom colors
  const customColorMatch = data.match(/CC\[(.*?)\]/);
  if (customColorMatch) {
    const [lineColor, cellColor] = customColorMatch[1].split("|");
    applyCellColor(cellColor);
    applyLineColor(lineColor);
    data = data.replace(customColorMatch[0], ""); // Remove custom color info from data
  }

  // Check for grid orientation and apply
  const orientationMatch = data.match(/O\[(X|Y)\]/);
  if (orientationMatch) {
    if (orientationMatch[1] === "X") {
      document.body.classList.add("grid-x");
    } else if (orientationMatch[1] === "Y") {
      document.body.classList.add("grid-y");
    }
    data = data.replace(orientationMatch[0], ""); // Remove orientation info from data
  }

  // Check for custom center dot position
  const centerMatch = data.match(/C\[(\d+),(\d+)\]/);
  if (centerMatch) {
    const centerRow = parseInt(centerMatch[1]) - 1;
    const centerCol = parseInt(centerMatch[2]) - 1;
    const newCenterIndex = centerRow * columns + centerCol;
    if (cells[newCenterIndex]) {
      // Remove existing center dot class (if any)
      const currentCenter = document.querySelector(".center-dot");
      if (currentCenter) {
        currentCenter.classList.remove("center-dot");
      }
      cells[newCenterIndex].classList.add("center-dot");
    }
    data = data.replace(centerMatch[0], ""); // Remove center info from data
  }

  // Regex to match R segments (colored ranges) and BR segments (blinking cells)
  const rangeRegex = /([G]?)\[(\d+)-(\d+)\]/g;
  const brRegex = /BR\[([\d,]+)\]/; // To extract columns from BR token

  // Create an array to hold all row data to parse them correctly
  const rowData = {};

  // Split the main data string by "R" or "BR" to isolate row segments
  const segments = data.split(/(R\d+|BR\[[\d,]+\])/).filter(Boolean); // Filters out empty strings from split

  let currentRow = -1;
  let currentRanges = "";
  let currentBlinks = "";

  // Reconstruct segments based on row numbers
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (segment.startsWith("R")) {
      const rowNumMatch = segment.match(/R(\d+)/);
      if (rowNumMatch) {
        const newRow = parseInt(rowNumMatch[1]) - 1;
        // If we're starting a new row, store previous row data
        if (currentRow !== -1 && (currentRanges || currentBlinks)) {
          rowData[currentRow] = {
            ranges: currentRanges,
            blinks: currentBlinks,
          };
        }
        currentRow = newRow;
        currentRanges = segment.slice(rowNumMatch[0].length);
        currentBlinks = ""; // Reset for new row
      }
    } else if (segment.startsWith("BR[")) {
      if (currentRow !== -1) {
        // Ensure it's associated with a row
        currentBlinks = segment;
      }
    } else if (currentRow !== -1) {
      // If it's a continuation of ranges for the current row
      currentRanges += segment;
    }
  }
  // Store the last row's data
  if (currentRow !== -1 && (currentRanges || currentBlinks)) {
    rowData[currentRow] = {
      ranges: currentRanges,
      blinks: currentBlinks,
    };
  }

  // Now, iterate through the collected row data and apply to grid
  for (const row in rowData) {
    if (rowData.hasOwnProperty(row)) {
      const rowObj = rowData[row];
      const rangesStr = rowObj.ranges;
      const blinkStr = rowObj.blinks;

      // Process ranges
      let rangeMatch;
      while ((rangeMatch = rangeRegex.exec(rangesStr)) !== null) {
        const colorMode = rangeMatch[1] === "G" ? "green" : "red";
        const start = parseInt(rangeMatch[2]) - 1;
        const end = parseInt(rangeMatch[3]) - 1;
        for (let col = start; col <= end; col++) {
          const index = row * columns + col;
          if (cells[index]) {
            setCellColorMode(cells[index], colorMode);
          }
        }
      }
      rangeRegex.lastIndex = 0; // Reset for next iteration

      // Process blinking cells
      const brMatch = blinkStr.match(brRegex);
      if (brMatch) {
        const blinkCols = brMatch[1].split(",").map(Number);
        blinkCols.forEach((colNum) => {
          const col = colNum - 1;
          const index = row * columns + col;
          if (cells[index]) {
            cells[index].classList.add("blink-animation");
          }
        });
      }
    }
  }

  // Process notes
  const noteRegex = /N\[(\d+),(\d+)\|([^\]]+)\]/g;
  let match;
  while ((match = noteRegex.exec(decoded)) !== null) {
    const row = parseInt(match[1]) - 1;
    const col = parseInt(match[2]) - 1;
    const note = match[3];
    const index = row * columns + col;
    if (cells[index]) {
      handleCellNote(cells[index], note);
    }
  }
}

/**
 * Compresses the grid data string using pako.
 *
 * @param {string} dataString - The grid data string to compress.
 * @returns {string} The compressed and base64-encoded string.
 */
function compressGridData(dataString) {
  const compressed = pako.deflate(dataString, { level: 9 });
  return base64UrlEncode(compressed);
}

/**
 * Decompresses a base64-encoded string using pako.
 *
 * @param {string} base64Str - The base64-encoded string to decompress.
 * @returns {string} The decompressed string.
 */
function decompressGridData(base64Str) {
  const binary = base64UrlDecode(base64Str);
  const decompressed = pako.inflate(binary, { to: "string" });
  return decompressed;
}

/* ----------------------
 * Utils
 * ---------------------- */

/**
 * Encodes a Uint8Array to a base64 URL-safe string.
 *
 * @param {Uint8Array} uint8array - The Uint8Array to encode.
 * @returns {string} The base64 URL-safe encoded string.
 */
function base64UrlEncode(uint8array) {
  let str = btoa(String.fromCharCode(...uint8array));
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decodes a base64 URL-safe string to a Uint8Array.
 *
 * @param {string} str - The base64 URL-safe encoded string to decode.
 * @returns {Uint8Array} The decoded Uint8Array.
 */
function base64UrlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const binaryStr = atob(str);
  return Uint8Array.from(binaryStr, (c) => c.charCodeAt(0));
}

/**
 * Toggles a class on an element.
 * It checks if the element has the specified class and adds or removes it accordingly.
 * @param {HTMLElement} element - The element to toggle the class on.
 * @param {string} className - The class name to toggle.
 */
function toggleClass(element, className) {
  if (element.classList.contains(className)) {
    element.classList.remove(className);
  } else {
    element.classList.add(className);
  }
}

/**
 * Starts the rain mode animation.
 * It creates a rain effect by randomly dropping colored cells down the grid.
 * Each drop has a tail length, and the cells blink as they fall.
 */
function startRain() {
  const grid = document.getElementById("grid");
  const cells = grid.children;
  const columns = parseInt(getComputedStyle(grid).gridTemplateColumns.split(" ").length);
  const rows = parseInt(getComputedStyle(grid).gridTemplateRows.split(" ").length);
  const tailLength = 4;

  rainInterval = setInterval(() => {
    const col = Math.floor(Math.random() * columns);
    let currentRow = 0;

    const drop = setInterval(() => {
      // Clear the cell that's now behind the tail
      const clearIndex = (currentRow - tailLength) * columns + col;
      if (currentRow >= tailLength && cells[clearIndex]) {
        clearCellColor(cells[clearIndex]);
        cells[clearIndex].classList.remove("blink-animation"); // Ensure blinking stops
      }

      // Add the new cell to the tail
      const index = currentRow * columns + col;
      if (cells[index]) {
        setCellColorMode(cells[index], "red");
      }

      currentRow++;

      if (currentRow >= rows + tailLength) {
        clearInterval(drop);
      }
    }, 50);
  }, 300);
}

/* ----------------------
 * Controls
 * ---------------------- */

/**
 * Adjusts the zoom level of the grid.
 * It scales the grid wrapper element based on the zoom level.
 * The zoom level is clamped between 0.1 and 3.
 * @param {number} delta - The amount to adjust the current zoom level by.
 * @param {number|null} setBaseZoomLevel - Optional parameter to set a specific base zoom level to apply the delta.
 */
function adjustZoom(delta, setBaseZoomLevel = null) {
  zoomLevel = setBaseZoomLevel !== null ? setBaseZoomLevel : zoomLevel;
  zoomLevel = Math.max(0.1, Math.min(3, zoomLevel + delta));
  wrapper.style.transform = `scale(${zoomLevel})`;
  document.body.dataset.gridZoom = zoomLevel.toFixed(1);
}

/**
 * Toggles the dark theme for the grid.
 * It adds or removes the "dark" class from the body element.
 * This changes the background and text colors for better visibility.
 */
function toggleTheme() {
  document.body.classList.toggle("dark");
}

/**
 * Toggles the grid orientation between horizontal and vertical.
 * It switches the grid layout by adding or removing classes.
 * If the grid is currently horizontal, it switches to vertical and vice versa.
 */
function toggleGridOrientation() {
  if (document.body.classList.contains("grid-x")) {
    document.body.classList.remove("grid-x");
    document.body.classList.add("grid-y");
  } else if (document.body.classList.contains("grid-y")) {
    document.body.classList.remove("grid-y");
  } else {
    document.body.classList.add("grid-x");
  }
}

/**
 * Toggles the rain mode on or off.
 * When rain mode is active, it starts the rain animation.
 * When rain mode is deactivated, it clears the rain interval and removes all colored cells.
 */
function toggleRainMode() {
  rainMode = !rainMode;
  if (rainMode) {
    startRain();
    document.body.classList.add("rain-mode");
  } else {
    clearInterval(rainInterval);
    // Clear all colored cells when exiting rain mode
    document
      .querySelectorAll(".grid-cell.colored, .grid-cell.colored-green, .grid-cell.blink-animation") // Clear blinking cells too
      .forEach((cell) => {
        clearCellColor(cell);
        cell.classList.remove("blink-animation");
      });
    document.body.classList.remove("rain-mode");
  }
}

/**
 * Toggles fullscreen mode for the document.
 * It checks if the document is currently in fullscreen mode and requests or exits fullscreen accordingly.
 */
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}

/**
 * Copies the current grid state as a shareable link.
 * It generates a URL with the grid data encoded in base64 format.
 * If rain mode is active, it alerts the user to disable it first.
 */
function copyShareLink() {
  if (rainMode) {
    alert("Disable Rain Mode to share.");
    return;
  }

  const grid = document.getElementById("grid");
  const columns = parseInt(getComputedStyle(grid).gridTemplateColumns.split(" ").length);
  const rows = parseInt(getComputedStyle(grid).gridTemplateRows.split(" ").length);
  const dataStr = getGridDataString(columns, rows);
  const url = new URL(window.location.href);
  url.hash = ""; // Clear the hash
  url.searchParams.set("data", dataStr);
  navigator.clipboard.writeText(url.toString());
  alert("Link copiado!");
}

/**
 * Handles clicks on the dropdown menu.
 * It toggles the "active" class on the dropdown menu to show or hide it.
 * It also prevents the click from propagating to the document, which would close the menu.
 *
 * @param {Event} event - The click event.
 * @param {HTMLElement} dropdownToggle - The dropdown element that was clicked.
 */
function handleDropdownClick(event, dropdownToggle) {
  event.stopPropagation(); // Prevent the click from propagating to the document
  // Toggle only if the clicked target is the dropdown toggle
  if (event.target === dropdownToggle) {
    toggleClass(dropdownToggle, "active");
  }
}

/* ----------------------
 * Event Listeners
 * ---------------------- */

window.addEventListener("load", () => {
  // Handle dropdown menu clicks
  document.querySelectorAll("button:has(.dropdown)").forEach((button) => {
    button.addEventListener("click", (event) => handleDropdownClick(event, button));
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (event) => {
    const dropdowns = document.querySelectorAll("button:has(.dropdown)");
    dropdowns.forEach((dropdown) => {
      if (!dropdown.contains(event.target)) {
        dropdown.classList.remove("active");
      }
    });
  });

  // Close dropdown when pressing Escape
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const dropdowns = document.querySelectorAll("button:has(.dropdown)");
      dropdowns.forEach((dropdown) => {
        dropdown.classList.remove("active");
      });
    }
  });

  // Add double click to prompt note on cells
  document.getElementById("grid").addEventListener("dblclick", (e) => {
    const cell = e.target.closest(".grid-cell");
    if (!cell) return;

    const existingNote = cell.querySelector(".cell-note");
    const currentText = existingNote ? existingNote.textContent : "";

    const newNote = prompt("Adicionar nota:", currentText);
    if (newNote === null) return; // Cancelled
    handleCellNote(cell, newNote);
  });

  // Set mouse down state
  window.addEventListener("mouseup", () => {
    isMouseDown = false;
  });

  // Prevent right-click context menu since it is used for erasing
  window.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });

  // Handle keyboard shortcuts
  window.addEventListener("keydown", (e) => {
    syncKeyboardModifierState(e);

    if (arrowKeys.has(e.key)) {
      e.preventDefault();

      if (!activeArrowKeys.has(e.key)) {
        activeArrowKeys.add(e.key);
        const { dx, dy } = getArrowMovementDelta();
        moveKeyboardHover(dx, dy);

        if (isKeyboardPaintDown) {
          paintKeyboardHoverCell(getPaintOptionsFromKeyboardState());
        }
      }

      startKeyboardMoveLoop();
      return;
    }

    if (e.code === "Space") {
      e.preventDefault();
      isKeyboardPaintDown = true;
      paintKeyboardHoverCell(getPaintOptionsFromKeyboardState());
      return;
    }

    if (e.ctrlKey) {
      // Invert colors
      if (e.key.toLowerCase() === "i") {
        e.preventDefault();
        toggleTheme();
      }
      // Toggle grid orientation
      else if (e.key.toLowerCase() === "o") {
        e.preventDefault();
        toggleGridOrientation();
      }
      // Copy share link
      else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        copyShareLink();
      }
      // Toggle rain mode
      else if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        toggleRainMode();
      }
      // Zoom in or out
      else if (e.key === "+" || e.key === "=" || e.key === "Add") {
        e.preventDefault();
        adjustZoom(0.1);
      } else if (e.key === "-" || e.key === "Subtract") {
        e.preventDefault();
        adjustZoom(-0.1);
      }
      // Reset grid
      else if (e.key.toLowerCase() === "backspace") {
        e.preventDefault();
        resetGrid();
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      paintKeyboardHoverCell(getPaintOptionsFromInput(e, false));
    } else if (e.key.toLowerCase() === "backspace") {
      e.preventDefault();
      clearPaintedCells();
    }
  });

  window.addEventListener("keyup", (e) => {
    syncKeyboardModifierState(e);

    if (e.code === "Space") {
      isKeyboardPaintDown = false;
    }

    if (!arrowKeys.has(e.key)) return;

    activeArrowKeys.delete(e.key);
    if (activeArrowKeys.size === 0) {
      stopKeyboardMoveLoop();
    }
  });

  window.addEventListener("blur", () => {
    isKeyboardPaintDown = false;
    keyboardModifierState.ctrlPressed = false;
    keyboardModifierState.shiftPressed = false;
    keyboardModifierState.altPressed = false;
    activeArrowKeys.clear();
    stopKeyboardMoveLoop();
  });

  // Load grid data from URL parameters or draw default grid
  const urlParams = new URLSearchParams(window.location.search);
  const data = urlParams.get("data");

  if (data) {
    setGridDataFromString(data);

    // Clear the URL parameter after loading
    // Only do this if &clear=true
    if (urlParams.get("clear") === "true") {
      urlParams.delete("data");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  } else {
    drawGrid(); // default (responsive)
    window.addEventListener("resize", drawGrid);
  }
});
