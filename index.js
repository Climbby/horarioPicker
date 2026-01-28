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
    disciplineIds[disciplineName] = course.class_id;
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
const disciplineIds = {};
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
let showRoom = false;

let isDeleteMode = false;
let isLockMode = false;
const lockedClasses = {}; // { discipline: [turma1, turma2...] }

// History Management
const undoStack = [];
const redoStack = [];
const MAX_STACK_SIZE = 50;



// Update saveState to include lockedClasses
function saveState() {
  const currentState = {
    selectedClasses: JSON.parse(JSON.stringify(selectedClasses)),
    disciplineColors: JSON.parse(JSON.stringify(disciplineColors)),
    lockedClasses: JSON.parse(JSON.stringify(lockedClasses))
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
    disciplineColors: JSON.parse(JSON.stringify(disciplineColors)),
    lockedClasses: JSON.parse(JSON.stringify(lockedClasses))
  };
  redoStack.push(currentState);
  
  const prevState = undoStack.pop();
  applyState(prevState);
}

function redo() {
  if (redoStack.length === 0) return;
  
  const currentState = {
    selectedClasses: JSON.parse(JSON.stringify(selectedClasses)),
    disciplineColors: JSON.parse(JSON.stringify(disciplineColors)),
    lockedClasses: JSON.parse(JSON.stringify(lockedClasses))
  };
  undoStack.push(currentState);
  
  const nextState = redoStack.pop();
  applyState(nextState);
}

function applyState(state) {
  // Clear selectedClasses
  for (const key in selectedClasses) delete selectedClasses[key];
  Object.assign(selectedClasses, state.selectedClasses);
  
  // Clear disciplineColors
  for (const key in disciplineColors) delete disciplineColors[key];
  Object.assign(disciplineColors, state.disciplineColors);

  // Clear lockedClasses
  for (const key in lockedClasses) delete lockedClasses[key];
  if (state.lockedClasses) {
      Object.assign(lockedClasses, state.lockedClasses);
  }
  
  updateUndoRedoButtons();
  
  // Refresh UI
  createDisciplineSelectors(); 
  updateSchedule();
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

  const toggleRoomBtn = document.getElementById("toggleRoomBtn");
  if (toggleRoomBtn) {
      toggleRoomBtn.checked = showRoom;
      toggleRoomBtn.addEventListener("change", (e) => {
        showRoom = e.target.checked;
        updateSchedule();
      });

  }

  const deleteModeBtn = document.getElementById("deleteModeBtn");
  if (deleteModeBtn) deleteModeBtn.addEventListener("click", toggleDeleteMode);

  const lockModeBtn = document.getElementById("lockModeBtn");
  if (lockModeBtn) lockModeBtn.addEventListener("click", toggleLockMode);

  const copyScheduleBtn = document.getElementById("copyScheduleBtn");
  if (copyScheduleBtn) copyScheduleBtn.addEventListener("click", copyScheduleToClipboard);

  const csvBtn = document.getElementById("csvBtn");
  if (csvBtn) csvBtn.addEventListener("click", downloadCSV);

  // Initialize slots
  updateSaveSlotsUI();
  
  // Attach Slot Listeners (delegated or direct)
  document.querySelectorAll(".save-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
        const slot = e.target.parentElement.dataset.slot;
        saveSlot(slot);
        // Optional: Close modal after save? Or keep open for verification?
        // Let's keep it open but show feedback.
    });
  });


  document.querySelectorAll(".load-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
        const slot = e.target.parentElement.dataset.slot;
        loadSlot(slot);
    });
  });

  document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
          const slot = e.target.parentElement.dataset.slot;
          if (confirm(`Tem certeza que deseja apagar o Slot ${slot}?`)) {
              deleteSlot(slot);
          }
      });
  });

  updateUndoRedoButtons();

  // Initialize schedule (now empty initially since no fixed classes)
  updateSchedule();
}

// --- SAVE / LOAD LOGIC ---

function saveSlot(slotIndex) {
    const dataToSave = {
        selectedClasses: selectedClasses,
        disciplineColors: disciplineColors,
        lockedClasses: lockedClasses,
        timestamp: new Date().getTime()
    };
    
    try {
        localStorage.setItem(`schedule_slot_${slotIndex}`, JSON.stringify(dataToSave));
        updateSaveSlotsUI();
        
        // Visual Feedback
        const slotGroup = document.querySelector(`.slot-group[data-slot="${slotIndex}"]`);
        if (slotGroup) {
            slotGroup.classList.add("saved-animation");
            setTimeout(() => slotGroup.classList.remove("saved-animation"), 500);
        }
    } catch (e) {
        console.error("Failed to save to localStorage", e);
        alert("Erro ao salvar! O armazenamento local pode estar cheio ou desabilitado.");
    }
}

function loadSlot(slotIndex) {
    const savedData = localStorage.getItem(`schedule_slot_${slotIndex}`);
    
    // Save current state to undo stack before changing anything
    saveState();

    if (!savedData) {
        // If empty, clear the board
        if (Object.keys(selectedClasses).length > 0 && confirm(`O Slot ${slotIndex} está vazio. Deseja limpar o quadro atual?`)) {
             // Clear all data
             for (const key in selectedClasses) delete selectedClasses[key];
             for (const key in disciplineColors) delete disciplineColors[key];
             for (const key in lockedClasses) delete lockedClasses[key];
             
             // Reset UI
             createDisciplineSelectors();
             updateSchedule();
             
             // Update Undo/Redo since we modified state
             updateUndoRedoButtons();
        } else if (Object.keys(selectedClasses).length === 0) {
             // Already empty, just visual feedback maybe?
             // alert("O quadro já está vazio."); 
        }
        return;
    }
    
    try {
        const state = JSON.parse(savedData);
        applyState(state); 
    } catch (e) {
        console.error("Failed to load slot", e);
        alert("Erro ao carregar o slot. Dados corrompidos.");
    }
}

function deleteSlot(slotIndex) {
    localStorage.removeItem(`schedule_slot_${slotIndex}`);
    updateSaveSlotsUI();
}

function updateSaveSlotsUI() {
    for (let i = 1; i <= 5; i++) {
        const savedData = localStorage.getItem(`schedule_slot_${i}`);
        const slotGroup = document.querySelector(`.slot-group[data-slot="${i}"]`);
        
        if (slotGroup) {
            const loadBtn = slotGroup.querySelector(".load-btn");
            const deleteBtn = slotGroup.querySelector(".delete-btn");

            if (savedData) {
                slotGroup.classList.add("has-data");
                slotGroup.classList.remove("empty");
                if (deleteBtn) deleteBtn.disabled = false;
                
                // Format timestamp
                try {
                    const parsed = JSON.parse(savedData);
                    const date = new Date(parsed.timestamp);
                    const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    loadBtn.title = `Carregar Slot ${i}\nSalvo em: ${dateStr}`;
                    loadBtn.textContent = `Slot ${i} (${dateStr})`;
                } catch(e) {
                     loadBtn.title = "Carregar Slot " + i;
                     loadBtn.textContent = `Slot ${i}`;
                }
            } else {
                slotGroup.classList.add("empty");
                slotGroup.classList.remove("has-data");
                if (deleteBtn) deleteBtn.disabled = true; // Disable delete if empty
                
                loadBtn.title = "Clique para limpar o quadro";
                loadBtn.textContent = `Slot ${i} (Vazio)`;
            }
        }
    }
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
      
      // Only show remove button if NOT locked
      if (lockedClasses[discipline] && lockedClasses[discipline].includes(turma)) {
          removeButton.style.display = "none";
      }

      removeButton.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent triggering the turma button click
        // Extra safety check
        if (lockedClasses[discipline] && lockedClasses[discipline].includes(turma)) return;

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
          // Check if locked
          if (lockedClasses[discipline] && lockedClasses[discipline].includes(turma)) {
                 // Prevent deselection if locked
                 button.style.animation = "shake 0.5s";
                 setTimeout(() => button.style.animation = "", 500);
                 return;
           }

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

            // --- NEW LAYOUT STRUCTURE ---
            // Top: Name/Sigla
            // Bottom: Room (Left), Turma (Right)
            
            // 1. Top Container (Name)
            const topDiv = document.createElement("div");
            topDiv.className = "class-info-top";
            
            const nameSpan = document.createElement("span");
            nameSpan.className = "discipline-name";
            nameSpan.textContent = displayName;
            topDiv.appendChild(nameSpan);

            // 2. Bottom Container (Room + Turma)
            const bottomDiv = document.createElement("div");
            bottomDiv.className = "class-info-bottom";

            // Room (Left)
            if (showRoom && classInfo.room) {
                const roomSpan = document.createElement("span");
                roomSpan.className = "class-room";
                roomSpan.textContent = classInfo.room;
                bottomDiv.appendChild(roomSpan);
            } else {
                 // Push turma to right even if room is missing? 
                 // If we want Turma ALWAYS on right, we can leave this empty or use auto margins.
                 // Flex verify: justify-content: space-between will handle it if there's only one item, 
                 // it might put it on left unless we handle it. 
                 // Let's add a spacer if room is missing but we want structure? 
                 // simpler: just append room if exists. CSS 'justify-content: space-between'
                 // If only Turma exists, it will be on left. 
                 // Use marginLeft: auto for Turma to force it right?
            }

            // Turma (Right)
            if (showTurma) {
                const turmaSpan = document.createElement("span");
                turmaSpan.className = "turma-name";
                turmaSpan.textContent = turma.toUpperCase();
                // If room is missing, we still want this on the right? 
                // "turma on the bottom right".
                // We'll handle via CSS 'margin-left: auto' if needed or just space-between.
                // Best way for "bottom right" regardless of room: 
                // make sure room is first child, turma is last. 
                bottomDiv.appendChild(turmaSpan);
            }
            
            classBlock.appendChild(topDiv);
            classBlock.appendChild(bottomDiv);

            // Add Room to Tooltip
            const roomInfo = classInfo.room ? `\nSala: ${classInfo.room}` : "";
            classBlock.title = `${discipline} - ${turma.toUpperCase()}${roomInfo}`;

            // Check for conflicts
            if (occupiedSlots[cellId]) {
              hasConflicts = true;
            }

            // ADDED: Delete Mode Logic AND Lock Mode Logic
            classBlock.dataset.discipline = discipline;
            classBlock.dataset.turma = turma;
            
            // Check if locked
            if (lockedClasses[discipline] && lockedClasses[discipline].includes(turma)) {
                classBlock.classList.add("locked");
                classBlock.title += " (BLOQUEADO)";
            }

            classBlock.addEventListener("click", (e) => {
                if (isLockMode) {
                    // Toggle Lock
                    e.stopPropagation();
                    saveState();
                    toggleLockClass(discipline, turma);
                    createDisciplineSelectors(); // Refresh UI to update lock icons/buttons in the list
                    updateSchedule();
                } else if (isDeleteMode) {
                    e.stopPropagation();
                    
                    // Check if locked
                    if (lockedClasses[discipline] && lockedClasses[discipline].includes(turma)) {
                        // Locked! Shake or just ignore
                        classBlock.style.animation = "shake 0.5s";
                        setTimeout(() => classBlock.style.animation = "", 500);
                        return;
                    }

                    saveState();
                    if (selectedClasses[discipline]) {
                        selectedClasses[discipline] = selectedClasses[discipline].filter(t => t !== turma);
                        if (selectedClasses[discipline].length === 0) {
                            delete selectedClasses[discipline];
                        }
                    }
                    createDisciplineSelectors();
                    updateSchedule();
                }
            });

            cell.appendChild(classBlock);
            occupiedSlots[cellId] = true;
          }
        });
      }
    });
  });

  updateConflictStatus(hasConflicts);
}

function toggleDeleteMode() {
  if (isLockMode) toggleLockMode(); // Disable lock mode if enabling delete mode logic (optional, but good UX to have one active)
  isDeleteMode = !isDeleteMode;
  const btn = document.getElementById("deleteModeBtn");
  if (btn) btn.classList.toggle("active", isDeleteMode);
  document.body.classList.toggle("delete-mode", isDeleteMode);
}

function toggleLockMode() {
  if (isDeleteMode) toggleDeleteMode();
  isLockMode = !isLockMode;
  const btn = document.getElementById("lockModeBtn");
  if (btn) btn.classList.toggle("active", isLockMode);
  document.body.classList.toggle("lock-mode", isLockMode);
}

function toggleLockClass(discipline, turma) {
    if (!lockedClasses[discipline]) {
        lockedClasses[discipline] = [];
    }
    
    const index = lockedClasses[discipline].indexOf(turma);
    if (index === -1) {
        lockedClasses[discipline].push(turma);
    } else {
        lockedClasses[discipline].splice(index, 1);
        if (lockedClasses[discipline].length === 0) {
            delete lockedClasses[discipline];
        }
    }
}

function updateConflictStatus(hasConflicts) {
  const statusDiv = document.getElementById("conflictStatus");
  const csvBtn = document.getElementById("csvBtn");
  if (!statusDiv) return;

  const noClassesSelected = Object.keys(selectedClasses).length === 0;

  // If no classes selected, show neutral message
  if (noClassesSelected) {
    statusDiv.innerHTML =
      '<div class="no-conflicts" style="background-color: #95a5a6;">Selecione suas turmas</div>';
    if (csvBtn) csvBtn.disabled = true;
    return;
  }

  if (hasConflicts) {
    statusDiv.innerHTML =
      '<div class="conflicts-warning">⚠️ Atenção: Existem conflitos de horários!</div>';
    if (csvBtn) csvBtn.disabled = true;
  } else {
    statusDiv.innerHTML =
      '<div class="no-conflicts">✅ Sem conflitos de horários!</div>';
    if (csvBtn) csvBtn.disabled = false;
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
     if (lockedClasses[discipline]) {
          // Keep locked classes
          selectedClasses[discipline] = selectedClasses[discipline].filter(t => lockedClasses[discipline].includes(t));
          if (selectedClasses[discipline].length === 0) delete selectedClasses[discipline];
      } else {
        delete selectedClasses[discipline];
      }
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
    // Deselect all but locked
    if (lockedClasses[discipline]) {
       // Keep locked classes
       if (selectedClasses[discipline]) {
           selectedClasses[discipline] = selectedClasses[discipline].filter(t => lockedClasses[discipline].includes(t));
           if (selectedClasses[discipline].length === 0) delete selectedClasses[discipline];
       }
    } else {
        delete selectedClasses[discipline];
    }
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
      // Skip locked classes
      if (lockedClasses[discipline] && lockedClasses[discipline].includes(turma)) {
          return;
      }

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

function copyScheduleToClipboard() {
    const scheduleElement = document.getElementById("scheduleGrid");
    const copyBtn = document.getElementById("copyScheduleBtn");
    
    if (!scheduleElement) return;

    // Visual feedback that something is happening
    const originalContent = copyBtn.innerHTML;
    // Spinner or just disable
    copyBtn.disabled = true;
    copyBtn.style.cursor = "wait";

    html2canvas(scheduleElement, {
        scale: 2, // Improve quality
        backgroundColor: "#ffffff", // Ensure white background
        logging: false,
        useCORS: true 
    }).then(canvas => {
        canvas.toBlob(blob => {
            if (blob) {
                navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]).then(() => {
                    // Success feedback
                    showToast("Imagem copiada para a área de transferência!");
                    
                    // Change icon to checkmark temporarily
                    copyBtn.className = "control-button copy-btn success"; // Add success class if we want extra styling
                    copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                    copyBtn.style.backgroundColor = "#27ae60"; // Green for success
                    
                    setTimeout(() => {
                        copyBtn.innerHTML = originalContent;
                        copyBtn.disabled = false;
                        copyBtn.style.cursor = "pointer";
                        copyBtn.style.backgroundColor = ""; // Reset inline style to use CSS class
                    }, 2000);
                }).catch(err => {
                    console.error('Failed to copy: ', err);
                    showToast("Erro ao copiar imagem.");
                    copyBtn.disabled = false;
                    copyBtn.style.cursor = "pointer";
                });
            }
        });
    }).catch(err => {
        console.error("Error generating image:", err);
        showToast("Erro ao gerar imagem.");
        copyBtn.disabled = false;
        copyBtn.style.cursor = "pointer";
    });
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  
  toast.innerText = message;
  toast.className = "toast show";
  
  setTimeout(function(){ 
      toast.className = toast.className.replace("show", ""); 
  }, 3000);
}

document.addEventListener("DOMContentLoaded", async () => {
  await initializePage();
});


function downloadCSV() {
  if (Object.keys(selectedClasses).length === 0) {
    alert("Nenhuma turma selecionada para exportar!");
    return;
  }

  // Header matching table.csv
  const headers = ["CLASS", "PL", "TP", "T", "T/TP"];
  let csvContent = headers.join(",") + "\n";

  Object.keys(selectedClasses).forEach((discipline) => {
    const classId = disciplineIds[discipline];
    if (!classId) return; 

    // Initialize columns
    const columns = {
        "PL": [],
        "TP": [],
        "T": [],
        "T/TP": [] 
    };

    const turmas = selectedClasses[discipline];
    
    turmas.forEach(turma => {
        const match = turma.match(/^([A-Z]+)(\d+)$/); 
        if (match) {
            const type = match[1]; 
            const number = match[2];
            
            if (columns[type]) {
                columns[type].push(number);
            } else if (type === "OT") { 
                 columns["T/TP"].push(number);
            }
        }
    });

    const row = [
        classId,
        columns["PL"].join(" "), 
        columns["TP"].join(" "),
        columns["T"].join(" "),
        columns["T/TP"].join(" ")
    ];
    
    csvContent += row.join(",") + "\n";
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "horario_selecionado.csv");
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
