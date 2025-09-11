let scheduleData;

(async () => {
  try {
    const response = await fetch("./horarios.json");
    if (!response.ok) {
      throw new Error(`Erro ao carregar horarios.json: ${response.status}`);
    }
    scheduleData = await response.json();
  } catch (error) {
    console.error("Falha no carregamento dos dados:", error);
    // Opcional: Mostrar mensagem de erro na UI
    document.getElementById("disciplinesGrid").innerHTML =
      '<div class="error">Erro ao carregar horários. Verifique o arquivo horarios.json.</div>';
  }
})();

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
  // Aguarda os dados serem carregados
  while (!scheduleData) {
    await new Promise((resolve) => setTimeout(resolve, 100)); // Polling simples (pode ser otimizado)
  }

  if (!scheduleData || Object.keys(scheduleData).length === 0) {
    console.error("Nenhum dado de horários encontrado.");
    return;
  }

  createDisciplineSelectors();
  createScheduleGrid();
}

function createDisciplineSelectors() {
  const grid = document.getElementById("disciplinesGrid");

  Object.keys(scheduleData).forEach((discipline) => {
    const card = document.createElement("div");
    card.className = "discipline-card";

    const title = document.createElement("div");
    title.className = "discipline-title";
    title.textContent = discipline;

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
            (t) => t !== turma
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
            (t) => t !== turma
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

  // Empty corner cell
  const cornerCell = document.createElement("div");
  cornerCell.className = "schedule-header";
  cornerCell.textContent = "Horário";
  grid.appendChild(cornerCell);

  // Day headers
  days.forEach((day) => {
    const dayCell = document.createElement("div");
    dayCell.className = "schedule-header";
    dayCell.textContent =
      day.charAt(0).toUpperCase() + day.slice(1).replace("-feira", "");
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
      // Check if the turma still exists in scheduleData
      if (scheduleData[discipline] && scheduleData[discipline][turma]) {
        const classes = scheduleData[discipline][turma];

        classes.forEach((classInfo) => {
          const cellId = `${classInfo.dia}-${classInfo.horario}`;
          const cell = document.getElementById(cellId);

          if (cell) {
            const classBlock = document.createElement("div");
            classBlock.className = "class-block";
            classBlock.textContent = `${discipline} - ${turma.toUpperCase()}`;

            // Check for conflicts
            if (occupiedSlots[cellId]) {
              classBlock.classList.add("conflict");
              // Mark all blocks in this cell as conflict
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

  // Update conflict status
  updateConflictStatus(hasConflicts);
}

function updateConflictStatus(hasConflicts) {
  const statusDiv = document.getElementById("conflictStatus");

  if (Object.keys(selectedClasses).length === 0) {
    statusDiv.innerHTML = "";
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

// Add these functions to handle the select all and clear all actions
function selectAllTurmas() {
  // Clear current selections
  for (const discipline in selectedClasses) {
    delete selectedClasses[discipline];
  }

  // Select all turmas for all disciplines
  Object.keys(scheduleData).forEach((discipline) => {
    selectedClasses[discipline] = Object.keys(scheduleData[discipline]);
  });

  // Update UI to reflect selections
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
  // Clear all selections
  for (const discipline in selectedClasses) {
    delete selectedClasses[discipline];
  }

  // Update UI to reflect cleared selections
  document.querySelectorAll(".turma-button").forEach((button) => {
    button.classList.remove("selected");
  });

  updateSchedule();
}

// Initialize the page when DOM is loaded
document.addEventListener("DOMContentLoaded", async () => {
  await initializePage();

  setTimeout(() => {
    const selectAllBtn = document.getElementById("selectAllBtn");
    const clearAllBtn = document.getElementById("clearAllBtn");

    if (selectAllBtn) {
      selectAllBtn.addEventListener("click", selectAllTurmas);
    }

    if (clearAllBtn) {
      clearAllBtn.addEventListener("click", clearAllTurmas);
    }
  }, 500);
});
