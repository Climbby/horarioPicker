let scheduleData;

// UPDATED: Fixed classes array is now empty
const fixedClasses = [];

(async () => {
  try {
    // Point to the new JSON file
    const response = await fetch("./classes_filtered.json");
    if (!response.ok) {
      throw new Error(
        `Erro ao carregar classes_filtered.json: ${response.status}`,
      );
    }
    const rawData = await response.json();

    // Transform the new JSON structure to the app's expected format
    scheduleData = transformData(rawData);
  } catch (error) {
    console.error("Falha no carregamento dos dados:", error);
    // Show error message in UI
    const grid = document.getElementById("disciplinesGrid");
    if (grid) {
      grid.innerHTML =
        '<div class="error" style="padding: 20px; text-align: center; color: #e74c3c; font-weight: bold;">Erro ao carregar horários. Verifique o arquivo classes_filtered.json.</div>';
    }
  }
})();

// Helper function to convert new JSON format to the App's format
function transformData(rawData) {
  const newData = {};

  const dayMap = {
    Segunda: "segunda-feira",
    Terça: "terca-feira",
    Quarta: "quarta-feira",
    Quinta: "quinta-feira",
    Sexta: "sexta-feira",
  };

  rawData.forEach((course) => {
    const disciplineName = course.class_name;
    newData[disciplineName] = {};

    course.shifts.forEach((shift) => {
      // Only include if there is a valid schedule
      if (shift.schedule && shift.schedule.length > 0) {
        newData[disciplineName][shift.code] = {
           vagas: shift.available_slots || "0",
           schedule: shift.schedule.map((slot) => ({
             // Map "Segunda" -> "segunda-feira"
             dia: dayMap[slot.day] || slot.day.toLowerCase(),
             // Combine "09:00" and "11:00" -> "09:00-11:00"
             horario: `${slot.start}-${slot.end}`,
             room: slot.room,
          }))
        };
      }
    });

    // Clean up empty disciplines
    if (Object.keys(newData[disciplineName]).length === 0) {
      delete newData[disciplineName];
    }
  });

  return newData;
}

function getAcronym(text) {
  return text
    .match(/[A-ZÀ-ÖØ-Þ]/g) // Basic Latin + Latin-1 Supplement uppercase ranges
    ?.join("") || "";
}

const days = [
  "segunda-feira",
  "terca-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
];
const timeSlots = [
  "09:00-11:00",
  "11:00-13:00",
  "14:00-16:00",
  "16:00-18:00",
  "18:00-20:00",
];
const selectedClasses = {};
const disciplineColors = {};
const orderedColors = [
  "#2980b9", // Dark Blue
  "#c0392b", // Dark Red
  "#27ae60", // Dark Green
  "#8e44ad", // Dark Purple
  "#b8860b"  // Dark Goldenrod
];
const defaultColors = [
  "#3498db", "#e74c3c", "#2ecc71", "#f1c40f", "#9b59b6", 
  "#1abc9c", "#e67e22", "#34495e", "#d35400", "#c0392b",
  "#27ae60", "#2980b9", "#8e44ad", "#f39c12", "#16a085"
];
let showVagas = false;
let showTurma = true;
let showAcronym = true;

// History Management
const undoStack = [];
const redoStack = [];
const MAX_STACK_SIZE = 50;

function saveState() {
  const currentState = {
    selectedClasses: JSON.parse(JSON.stringify(selectedClasses)),
    disciplineColors: JSON.parse(JSON.stringify(disciplineColors))
  };
  
  undoStack.push(currentState);
  if (undoStack.length > MAX_STACK_SIZE) {
    undoStack.shift();
  }
  
  // Clear redo stack on new action
  redoStack.length = 0;
  
  updateUndoRedoButtons();
}

function undo() {
  if (undoStack.length === 0) return;
  
  const currentState = {
    selectedClasses: JSON.parse(JSON.stringify(selectedClasses)),
    disciplineColors: JSON.parse(JSON.stringify(disciplineColors))
  };
  redoStack.push(currentState);
  
  const prevState = undoStack.pop();
  applyState(prevState);
}

function redo() {
  if (redoStack.length === 0) return;
  
  const currentState = {
    selectedClasses: JSON.parse(JSON.stringify(selectedClasses)),
    disciplineColors: JSON.parse(JSON.stringify(disciplineColors))
  };
  undoStack.push(currentState);
  
  const nextState = redoStack.pop();
  applyState(nextState);
}

function applyState(state) {
  // Clear current object reference content without losing reference if possible, 
  // but since we rely on the global variable, we can just replace the content.
  // However, selectedClasses is a const? No, it's a const object, so we can't reassign the variable.
  // We must clear properties and reassign.
  
  // Clear selectedClasses
  for (const key in selectedClasses) delete selectedClasses[key];
  Object.assign(selectedClasses, state.selectedClasses);
  
  // Clear disciplineColors
  for (const key in disciplineColors) delete disciplineColors[key];
  Object.assign(disciplineColors, state.disciplineColors);
  
  updateUndoRedoButtons();
  
  // Refresh UI
  createDisciplineSelectors(); // Re-creates inputs with correct colors/checks
  updateSchedule();
}

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById("undoBtn");
    const redoBtn = document.getElementById("redoBtn");
    
    if (undoBtn) undoBtn.disabled = undoStack.length === 0;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

async function initializePage() {
  // Wait for data to load
  let attempts = 0;
  while (!scheduleData && attempts < 20) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    attempts++;
  }

  if (!scheduleData || Object.keys(scheduleData).length === 0) {
    console.error("Nenhum dado de horários encontrado.");
    const grid = document.getElementById("disciplinesGrid");
    if (grid) {
      grid.innerHTML =
        '<div class="error" style="padding: 20px; text-align: center; color: #e74c3c; font-weight: bold;">Nenhum dado de horários encontrado.</div>';
    }
    return;
  }

  createDisciplineSelectors();
  createScheduleGrid();

  // Add event listeners to buttons
  const toggleAllBtn = document.getElementById("toggleAllBtn");
  if (toggleAllBtn) toggleAllBtn.addEventListener("click", toggleAllTurmas);

  const restoreBtn = document.getElementById("restoreBtn");
  if (restoreBtn) restoreBtn.addEventListener("click", restoreClasses);

  const toggleTPBtn = document.getElementById("toggleTPBtn");
  if (toggleTPBtn) toggleTPBtn.addEventListener("click", toggleTPs);

  const undoBtn = document.getElementById("undoBtn");
  if (undoBtn) undoBtn.addEventListener("click", undo);

  const redoBtn = document.getElementById("redoBtn");
  if (redoBtn) redoBtn.addEventListener("click", redo);
  
  const toggleVagasBtn = document.getElementById("toggleVagasBtn");
  if (toggleVagasBtn) {
      toggleVagasBtn.addEventListener("change", (e) => {
        showVagas = e.target.checked;
        createDisciplineSelectors();
      });
  }

  const toggleTurmaBtn = document.getElementById("toggleTurmaBtn");
  if (toggleTurmaBtn) {
      toggleTurmaBtn.addEventListener("change", (e) => {
        showTurma = e.target.checked;
        updateSchedule();
      });
  }

  const toggleAcronymBtn = document.getElementById("toggleAcronymBtn");
  if (toggleAcronymBtn) {
      toggleAcronymBtn.checked = showAcronym; // Force sync
      toggleAcronymBtn.addEventListener("change", (e) => {
        showAcronym = e.target.checked;
        updateSchedule();
      });
  }

  // Force sync Turma button as well
  if (toggleTurmaBtn) {
      toggleTurmaBtn.checked = showTurma;
  }

  updateUndoRedoButtons();

  // Initialize schedule (now empty initially since no fixed classes)
  updateSchedule();
}

function createDisciplineSelectors() {
  const grid = document.getElementById("disciplinesGrid");
  grid.innerHTML = ""; // Clear existing content

  Object.keys(scheduleData).forEach((discipline, index) => {
    const card = document.createElement("div");
    card.className = "discipline-card";

    const title = document.createElement("div");
    title.className = "discipline-title";
    
    // Create header container for title and toggle button
    const headerContainer = document.createElement("div");
    headerContainer.className = "discipline-header-container";
    
    const titleText = document.createElement("span");
    const acronym = getAcronym(discipline);
    titleText.textContent = `${discipline} (${acronym})`;
    titleText.title = discipline;

    // Initialize color if not set
    if (!disciplineColors[discipline]) {
        if (index < orderedColors.length) {
            disciplineColors[discipline] = orderedColors[index];
        } else {
            // Assign a random default color
            const randomColor = defaultColors[Math.floor(Math.random() * defaultColors.length)];
            disciplineColors[discipline] = randomColor;
        }
    }

    // Apply initial color to title
    title.style.background = disciplineColors[discipline];
    title.style.color = "white"; // Ensure text is visible on colored background

    // Set CSS variable for the card to control button colors
    card.style.setProperty('--discipline-color', disciplineColors[discipline]);

    // Color Picker (Hidden Input)
    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = disciplineColors[discipline];
    colorInput.style.opacity = "0";
    colorInput.style.position = "absolute";
    colorInput.style.width = "0";
    colorInput.style.height = "0";
    colorInput.style.pointerEvents = "none";
    
    // Palette Button
    const paletteButton = document.createElement("button");
    paletteButton.textContent = "🎨";
    paletteButton.title = "Alterar cor";
    paletteButton.className = "palette-btn";
    paletteButton.style.fontSize = "1.2rem";
    paletteButton.style.background = "none";
    paletteButton.style.border = "none";
    paletteButton.style.cursor = "pointer";
    paletteButton.style.padding = "5px";
    paletteButton.style.transition = "transform 0.2s ease";
    paletteButton.style.marginRight = "5px";
    
    // Hover effect for palette
    paletteButton.addEventListener("mouseenter", () => paletteButton.style.transform = "scale(1.2)");
    paletteButton.addEventListener("mouseleave", () => paletteButton.style.transform = "scale(1.0)");
    
    // Trigger hidden input
    paletteButton.addEventListener("click", (e) => {
        e.stopPropagation();
        saveState();
        colorInput.click();
    });

    colorInput.addEventListener("input", (e) => {
        const newColor = e.target.value;
        disciplineColors[discipline] = newColor;
        title.style.background = newColor;
        // Update the CSS variable
        card.style.setProperty('--discipline-color', newColor);
        updateSchedule();
    });
    
    // Create Checkbox for "Select All"
    const toggleLabel = document.createElement("label");
    toggleLabel.className = "discipline-toggle-label";
    toggleLabel.title = "Selecionar/Deselecionar todas as turmas";
    
    const toggleCheckbox = document.createElement("input");
    toggleCheckbox.type = "checkbox";
    toggleCheckbox.className = "discipline-toggle-checkbox";
    
    // Check state
    const allTurmas = Object.keys(scheduleData[discipline]);
    const currentSelection = selectedClasses[discipline] || [];
    const isAllSelected = allTurmas.length > 0 && allTurmas.every(t => currentSelection.includes(t));
    toggleCheckbox.checked = isAllSelected;
    
    toggleCheckbox.addEventListener("change", (e) => {
        e.stopPropagation(); // Prevent bubbling if needed
        toggleDiscipline(discipline, e.target.checked);
    });

    const toggleCustom = document.createElement("span");
    toggleCustom.className = "discipline-toggle-custom";

    toggleLabel.appendChild(toggleCheckbox);
    toggleLabel.appendChild(toggleCustom);

    // Group controls
    const controlsContainer = document.createElement("div");
    controlsContainer.style.display = "flex";
    controlsContainer.style.alignItems = "center";
    controlsContainer.appendChild(colorInput); // Hidden
    controlsContainer.appendChild(paletteButton);
    controlsContainer.appendChild(toggleLabel);

    headerContainer.appendChild(titleText);
    headerContainer.appendChild(controlsContainer);
    title.appendChild(headerContainer);

    const selector = document.createElement("div");
    selector.className = "turma-selector";

    const label = document.createElement("label");
    label.textContent = "Selecionar Turma:";

    const buttonContainer = document.createElement("div");
    buttonContainer.className = "turma-buttons";

    // Add turma buttons
    Object.keys(scheduleData[discipline]).forEach((turma) => {
      const turmaContainer = document.createElement("div");
      turmaContainer.className = "turma-button-container";

      const button = document.createElement("button");
      button.className = "turma-button";
      button.textContent = showVagas 
        ? `${turma.toUpperCase()}(${scheduleData[discipline][turma].vagas})` 
        : turma.toUpperCase();
      button.dataset.discipline = discipline;
      button.dataset.turma = turma;

      // Check if already selected (for restore functionality)
      if (
        selectedClasses[discipline] &&
        selectedClasses[discipline].includes(turma)
      ) {
        button.classList.add("selected");
      }

      const removeButton = document.createElement("button");
      removeButton.className = "remove-turma";
      removeButton.textContent = "×";
      removeButton.title = `Remover ${turma.toUpperCase()}`;
      removeButton.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent triggering the turma button click
        saveState();
        // Remove the turma from the DOM
        turmaContainer.remove();
        // Remove the turma from selectedClasses
        if (selectedClasses[discipline]) {
          selectedClasses[discipline] = selectedClasses[discipline].filter(
            (t) => t !== turma,
          );
          if (selectedClasses[discipline].length === 0) {
            delete selectedClasses[discipline];
          }
          updateSchedule();
        }
        // Check if all turmas for this discipline are removed
        if (!buttonContainer.querySelector(".turma-button-container")) {
          card.remove(); // Remove the discipline card if no turmas remain
        }
      });

      button.addEventListener("click", () => {
        saveState();
        // Initialize selectedClasses[discipline] as an array if not already
        if (!selectedClasses[discipline]) {
          selectedClasses[discipline] = [];
        }

        // Toggle selection
        if (selectedClasses[discipline].includes(turma)) {
          selectedClasses[discipline] = selectedClasses[discipline].filter(
            (t) => t !== turma,
          );
          button.classList.remove("selected");
          if (selectedClasses[discipline].length === 0) {
            delete selectedClasses[discipline];
          }
        } else {
          selectedClasses[discipline].push(turma);
          button.classList.add("selected");
        }

        updateSchedule();
      });

      turmaContainer.appendChild(button);
      turmaContainer.appendChild(removeButton);
      buttonContainer.appendChild(turmaContainer);
    });

    selector.appendChild(label);
    selector.appendChild(buttonContainer);
    card.appendChild(title);
    card.appendChild(selector);
    grid.appendChild(card);
  });
}

function createScheduleGrid() {
  const grid = document.getElementById("scheduleGrid");
  grid.innerHTML = ""; // Clear existing grid

  // Empty corner cell
  const cornerCell = document.createElement("div");
  cornerCell.className = "schedule-header";
  cornerCell.textContent = "Horário";
  grid.appendChild(cornerCell);

  // Day headers
  days.forEach((day) => {
    const dayCell = document.createElement("div");
    dayCell.className = "schedule-header";

    const daySpan = document.createElement("span");
    daySpan.textContent =
      day.charAt(0).toUpperCase() + day.slice(1).replace("-feira", "");

    dayCell.appendChild(daySpan);
    dayCell.title = day.charAt(0).toUpperCase() + day.slice(1);
    grid.appendChild(dayCell);
  });

  // Time slots and cells
  timeSlots.forEach((time) => {
    // Time slot header
    const timeCell = document.createElement("div");
    timeCell.className = "time-slot";
    timeCell.textContent = time;
    grid.appendChild(timeCell);

    // Day cells for this time slot
    days.forEach((day) => {
      const cell = document.createElement("div");
      cell.className = "schedule-cell";
      cell.id = `${day}-${time}`;
      grid.appendChild(cell);
    });
  });
}

function updateSchedule() {
  // Clear all cells
  document.querySelectorAll(".schedule-cell").forEach((cell) => {
    cell.innerHTML = "";
    cell.classList.remove("conflict");
  });

  const occupiedSlots = {};
  let hasConflicts = false;

  // Add selected classes to schedule
  Object.entries(selectedClasses).forEach(([discipline, turmas]) => {
    turmas.forEach((turma) => {
      if (scheduleData[discipline] && scheduleData[discipline][turma]) {
        const classes = scheduleData[discipline][turma].schedule;

        classes.forEach((classInfo) => {
          const cellId = `${classInfo.dia}-${classInfo.horario}`;
          const cell = document.getElementById(cellId);

          if (cell) {
            const classBlock = document.createElement("div");
            classBlock.className = "class-block";

            // Apply custom color if it exists
            if (disciplineColors[discipline]) {
                classBlock.style.background = disciplineColors[discipline];
                classBlock.style.color = "white"; // Assume dark colors for now, or calculate contrast
            }

            // Use acronym for mobile and desktop for consistency if requested, or just acronym
            // User asked: "this this acronym shows up iin the horario"
            const acronym = getAcronym(discipline);
            
            // Determine what to show for course name (Acronym vs Full Name)
            const displayName = showAcronym ? acronym : discipline;

            if (showTurma) {
                // Use a container for flex control if needed, but class-block is already flex.
                // We want: [Name (truncated)] [ - Turma]
                
                const nameSpan = document.createElement("span");
                nameSpan.className = "discipline-name";
                nameSpan.textContent = displayName;
                
                const separatorSpan = document.createElement("span");
                separatorSpan.className = "separator-text";
                separatorSpan.textContent = " - ";
                
                const turmaSpan = document.createElement("span");
                turmaSpan.className = "turma-name";
                turmaSpan.textContent = turma.toUpperCase();

                classBlock.appendChild(nameSpan);
                classBlock.appendChild(separatorSpan);
                classBlock.appendChild(turmaSpan);
            } else {
                const nameSpan = document.createElement("span");
                nameSpan.className = "discipline-name";
                nameSpan.textContent = displayName;
                classBlock.appendChild(nameSpan);
            }

            // Add Room to Tooltip
            const roomInfo = classInfo.room ? `\nSala: ${classInfo.room}` : "";
            classBlock.title = `${discipline} - ${turma.toUpperCase()}${roomInfo}`;

            // Check for conflicts
            if (occupiedSlots[cellId]) {
              hasConflicts = true;
            }

            cell.appendChild(classBlock);
            occupiedSlots[cellId] = true;
          }
        });
      }
    });
  });

  updateConflictStatus(hasConflicts);
}

function updateConflictStatus(hasConflicts) {
  const statusDiv = document.getElementById("conflictStatus");
  if (!statusDiv) return;

  // If no classes selected, show neutral message
  if (Object.keys(selectedClasses).length === 0) {
    statusDiv.innerHTML =
      '<div class="no-conflicts" style="background-color: #95a5a6;">Selecione suas turmas</div>';
    return;
  }

  if (hasConflicts) {
    statusDiv.innerHTML =
      '<div class="conflicts-warning">⚠️ Atenção: Existem conflitos de horários!</div>';
  } else {
    statusDiv.innerHTML =
      '<div class="no-conflicts">✅ Sem conflitos de horários!</div>';
  }
}

function toggleAllTurmas() {
  saveState();
  let allSelected = true;

  // Check if everything is selected
  const disciplines = Object.keys(scheduleData);
  if (disciplines.length === 0) return;

  for (const discipline of disciplines) {
    const allTurmas = Object.keys(scheduleData[discipline]);
    const currentSelection = selectedClasses[discipline] || [];
    
    // If usage of discipline has discrepancy in count, it's not all selected
    if (allTurmas.length !== currentSelection.length) {
      allSelected = false;
      break;
    }
  }

  // If even one discipline in scheduleData is missing from selectedClasses keys (and has turmas), it's not all selected
  if (Object.keys(selectedClasses).length < disciplines.length) {
     // This check is a bit rough, better to rely on loop above, but if selectedClasses has fewer keys, definitely not all selected
     // However, loop above covers it.
  }

  if (allSelected) {
    // Clear all
    clearAllTurmas();
  } else {
    // Select all
    selectAllTurmas();
  }
}

function selectAllTurmas() {
  for (const discipline in selectedClasses) {
    delete selectedClasses[discipline];
  }

  Object.keys(scheduleData).forEach((discipline) => {
    selectedClasses[discipline] = Object.keys(scheduleData[discipline]);
  });
  
  // Update all UI components including individual discipline toggles
  createDisciplineSelectors();
  updateSchedule();
}

function clearAllTurmas() {
  for (const discipline in selectedClasses) {
    delete selectedClasses[discipline];
  }

  // Update all UI components including individual discipline toggles
  createDisciplineSelectors();
  updateSchedule();
}

function restoreClasses() {
  saveState();
  // Simply re-running this will recreate all cards from scheduleData
  // Since we updated createDisciplineSelectors to check selectedClasses, selections are preserved
  createDisciplineSelectors();
}

function toggleDiscipline(discipline, shouldSelectAll) {
  if (!scheduleData[discipline]) return;
  saveState();

  const allTurmas = Object.keys(scheduleData[discipline]);

  if (!shouldSelectAll) {
    // Deselect all
    delete selectedClasses[discipline];
  } else {
    // Select all
    selectedClasses[discipline] = [...allTurmas];
  }

  // Update UI keeping the scroll position ideally, or just re-render
  createDisciplineSelectors();
  updateSchedule();
}

function toggleTPs() {
  saveState();
  const allTPs = [];
  let allSelected = true;

  // Find all TP classes
  Object.keys(scheduleData).forEach((discipline) => {
    Object.keys(scheduleData[discipline]).forEach((turma) => {
      // Check if it's a TP class (usually starts with TP or contains TP)
      // Adapting check to be robust, though data usually is like "TP1", "TP12"
      if (turma.toUpperCase().includes("TP")) {
        allTPs.push({ discipline, turma });
        // Check if currently selected
        if (
          !selectedClasses[discipline] ||
          !selectedClasses[discipline].includes(turma)
        ) {
          allSelected = false;
        }
      }
    });
  });

  if (allTPs.length === 0) return;

  if (allSelected) {
    // Deselect all TPs
    allTPs.forEach(({ discipline, turma }) => {
      if (selectedClasses[discipline]) {
        selectedClasses[discipline] = selectedClasses[discipline].filter(
          (t) => t !== turma,
        );
        if (selectedClasses[discipline].length === 0) {
          delete selectedClasses[discipline];
        }
      }
    });
  } else {
    // Select all TPs
    allTPs.forEach(({ discipline, turma }) => {
      if (!selectedClasses[discipline]) {
        selectedClasses[discipline] = [];
      }
      if (!selectedClasses[discipline].includes(turma)) {
        selectedClasses[discipline].push(turma);
      }
    });
  }

  // Update UI to reflect changes
  // We can just re-render selectors to be lazy and ensure consistency,
  // or manually toggle classes. Re-rendering is safer given the "remove" button logic could complicate things manually.
  // Actually, let's just re-run createDisciplineSelectors to sync buttons state and then update schedule.
  createDisciplineSelectors();
  updateSchedule();
}

document.addEventListener("DOMContentLoaded", async () => {
  await initializePage();
});
