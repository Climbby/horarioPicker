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
        newData[disciplineName][shift.code] = shift.schedule.map((slot) => ({
          // Map "Segunda" -> "segunda-feira"
          dia: dayMap[slot.day] || slot.day.toLowerCase(),
          // Combine "09:00" and "11:00" -> "09:00-11:00"
          horario: `${slot.start}-${slot.end}`,
          room: slot.room,
        }));
      }
    });

    // Clean up empty disciplines
    if (Object.keys(newData[disciplineName]).length === 0) {
      delete newData[disciplineName];
    }
  });

  return newData;
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
  const selectAllBtn = document.getElementById("selectAllBtn");
  if (selectAllBtn) selectAllBtn.addEventListener("click", selectAllTurmas);

  const clearAllBtn = document.getElementById("clearAllBtn");
  if (clearAllBtn) clearAllBtn.addEventListener("click", clearAllTurmas);

  // Initialize schedule (now empty initially since no fixed classes)
  updateSchedule();
}

function createDisciplineSelectors() {
  const grid = document.getElementById("disciplinesGrid");
  grid.innerHTML = ""; // Clear existing content

  Object.keys(scheduleData).forEach((discipline) => {
    const card = document.createElement("div");
    card.className = "discipline-card";

    const title = document.createElement("div");
    title.className = "discipline-title";
    title.textContent = discipline;
    title.title = discipline;

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
      button.textContent = turma.toUpperCase();
      button.dataset.discipline = discipline;
      button.dataset.turma = turma;

      const removeButton = document.createElement("button");
      removeButton.className = "remove-turma";
      removeButton.textContent = "×";
      removeButton.title = `Remover ${turma.toUpperCase()}`;
      removeButton.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent triggering the turma button click
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
        const classes = scheduleData[discipline][turma];

        classes.forEach((classInfo) => {
          const cellId = `${classInfo.dia}-${classInfo.horario}`;
          const cell = document.getElementById(cellId);

          if (cell) {
            const classBlock = document.createElement("div");
            classBlock.className = "class-block";

            // Use abbreviated text for mobile
            const disciplineName = discipline;
            const shortName =
              disciplineName.length > 15
                ? disciplineName.substring(0, 12) + "..."
                : disciplineName;

            classBlock.textContent = `${shortName} - ${turma.toUpperCase()}`;

            // Add Room to Tooltip
            const roomInfo = classInfo.room ? `\nSala: ${classInfo.room}` : "";
            classBlock.title = `${discipline} - ${turma.toUpperCase()}${roomInfo}`;

            // Check for conflicts
            if (occupiedSlots[cellId]) {
              classBlock.classList.add("conflict");
              const existingBlocks = cell.querySelectorAll(".class-block");
              existingBlocks.forEach((block) => {
                block.classList.add("conflict");
              });
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

function selectAllTurmas() {
  for (const discipline in selectedClasses) {
    delete selectedClasses[discipline];
  }

  Object.keys(scheduleData).forEach((discipline) => {
    selectedClasses[discipline] = Object.keys(scheduleData[discipline]);
  });

  document.querySelectorAll(".turma-button").forEach((button) => {
    const discipline = button.dataset.discipline;
    const turma = button.dataset.turma;

    if (
      selectedClasses[discipline] &&
      selectedClasses[discipline].includes(turma)
    ) {
      button.classList.add("selected");
    } else {
      button.classList.remove("selected");
    }
  });

  updateSchedule();
}

function clearAllTurmas() {
  for (const discipline in selectedClasses) {
    delete selectedClasses[discipline];
  }

  document.querySelectorAll(".turma-button").forEach((button) => {
    button.classList.remove("selected");
  });

  updateSchedule();
}

document.addEventListener("DOMContentLoaded", async () => {
  await initializePage();
});
