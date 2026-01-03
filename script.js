// Configuración inicial
const MONTHLY_FEE = 10;
const LATE_FEE_RATE = 0.10; // 10%

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Datos de los 16 apartamentos
let apartments = [];

// Función para cargar la base de datos
async function loadDatabase() {
    try {
        const storedData = localStorage.getItem('condoApartments');
        if (storedData) {
            apartments = JSON.parse(storedData);
        } else {
            const response = await fetch('database.json');
            const data = await response.json();
            apartments = data.apartments;
        }
        
        // Poblar el select de owners
        const owners = [...new Set(apartments.map(a => a.owner))];
        owners.forEach(owner => {
            const opt = document.createElement('option');
            opt.value = owner;
            opt.innerText = owner;
            ownerSelect.appendChild(opt);
        });
        renderTable();
    } catch (error) {
        console.error("Error cargando la base de datos:", error);
        alert("Error cargando database.json. Asegúrate de ejecutar esto en un servidor local.");
    }
}

// Elementos del DOM
const tableBody = document.getElementById('tableBody');
const currentMonthInput = document.getElementById('currentMonth');
const modal = document.getElementById('paymentModal');
const paymentForm = document.getElementById('paymentForm');

// Crear Select para filtrar por Owner
const ownerSelect = document.createElement('select');
ownerSelect.id = 'ownerFilter';
ownerSelect.style.marginLeft = '10px';
ownerSelect.innerHTML = '<option value="">Mostrar Todos</option>';
//currentMonthInput.parentNode.insertBefore(ownerSelect, currentMonthInput.nextSibling);
const selectContainer = document.getElementById('select_container');
selectContainer.appendChild(ownerSelect);
ownerSelect.addEventListener('change', renderTable);

let selectedAptoId = null;
let selectedYear = null;
let selectedMonth = null;

// Función para calcular deuda
function calculateAptoDebt(apto, currentMonthStr) {
    const currentDate = new Date(currentMonthStr + "-01");
    const currentYear = currentDate.getFullYear();
    const currentMonthIdx = currentDate.getMonth();

    let debts = { "2024": 0, "2025": 0, "2026": 0, total: 0 };

    ["2024", "2025", "2026"].forEach(yearStr => {
        const yearInt = parseInt(yearStr);
        
        MONTH_NAMES.forEach((monthName, monthIdx) => {
            // Solo calcular hasta el mes actual seleccionado
            if (yearInt < currentYear || (yearInt === currentYear && monthIdx <= currentMonthIdx)) {
                const due = apto.debts[yearStr]?.[monthName] || 0;
                const paid = apto.payments[yearStr]?.[monthName] || 0;
                const balance = due - paid;

                if (balance > 0) {
                    // Calcular mora si el mes ya pasó (interés simple mensual)
                    const monthsLate = (currentYear - yearInt) * 12 + (currentMonthIdx - monthIdx) + 1; // +1 para incluir el mes actual
                    let interest = 0;
                    if (monthsLate > 0) {
                        interest = balance * LATE_FEE_RATE * monthsLate;
                    }
                    debts[yearStr] += balance + interest;
                }
            }
        });
    });

    debts.total = debts["2024"] + debts["2025"] + debts["2026"];
    return debts;
}

// Renderizar tabla
function renderTable() {
    // Actualizar encabezados de la tabla dinámicamente
    const theadRow = document.querySelector('table thead tr') || tableBody.parentElement.querySelector('thead tr');

    tableBody.innerHTML = '';
    const currentMonth = currentMonthInput.value;
    const selectedOwner = ownerSelect.value;
    const currentDate = new Date(currentMonth + "-01");
    const currentYear = currentDate.getFullYear();
    const currentMonthIdx = currentDate.getMonth();

    const filtered = selectedOwner ? apartments.filter(a => a.owner === selectedOwner) : apartments;

    if (selectedOwner) {
        // Vista detallada por mes
        if (theadRow) {
            theadRow.innerHTML = `
                <th>Apto</th>
                <th>Año</th>
                <th>Mes</th>
                <th>Cuota</th>
                <th>Pagado</th>
                <th>Mora</th>
                <th>Pago Mora</th>
                <th>Deuda</th>
                <th>Acción</th>
            `;
        }

        filtered.forEach(apto => {
            ["2024", "2025", "2026"].forEach(yearStr => {
                const yearInt = parseInt(yearStr);
                MONTH_NAMES.forEach((monthName, monthIdx) => {
                    if (yearInt < currentYear || (yearInt === currentYear && monthIdx <= currentMonthIdx)) {
                        const due = apto.debts[yearStr]?.[monthName] || 0;
                        const paid = apto.payments[yearStr]?.[monthName] || 0;
                        const partialPaid = apto.partials[yearStr]?.[monthName] || 0;
                        const balance = due - paid;

                        if (balance > 0) {
                            const monthsLate = (currentYear - yearInt) * 12 + (currentMonthIdx - monthIdx) + 1; // +1 para incluir el mes actual
                            let interest = 0;
                            if (monthsLate > 0) {
                                interest = balance * LATE_FEE_RATE * monthsLate;
                            }
                            const total = balance + interest - partialPaid;

                            const row = `
                                <tr>
                                    <td>${apto.id}</td>
                                    <td>${yearStr}</td>
                                    <td>${monthName}</td>
                                    <td>$${due.toFixed(2)}</td>
                                    <td>$${paid.toFixed(2)}</td>
                                    <td style="color: red">$${(interest-partialPaid).toFixed(2)}</td>
                                    <td>$${(partialPaid).toFixed(2)}</td>
                                    <td><strong>$${total.toFixed(2)}</strong></td>
                                    <td><button class="btn-pay" onclick="openModal('${apto.id}', '${yearStr}', '${monthName}')">Pagar</button></td>
                                </tr>
                            `;
                            tableBody.innerHTML += row;
                        }
                    }
                });
            });
        });
    } else {
        // Vista resumen
        if (theadRow) {
            theadRow.innerHTML = `
                <th>ID</th>
                <th>Propietario</th>
                <th>Deuda 2024</th>
                <th>Deuda 2025</th>
                <th>Deuda 2026</th>
                <th>Total</th>
            `;
        }

        filtered.forEach(apto => {
            const debtInfo = calculateAptoDebt(apto, currentMonth);
            const row = `
                <tr>
                    <td>${apto.id}</td>
                    <td>${apto.owner}</td>
                    <td>$${debtInfo["2024"].toFixed(2)}</td>
                    <td>$${debtInfo["2025"].toFixed(2)}</td>
                    <td>$${debtInfo["2026"].toFixed(2)}</td>
                    <td><strong>$${debtInfo.total.toFixed(2)}</strong></td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });
    }
}

// Manejo del Modal
function openModal(id, year = null, month = null) {
    selectedAptoId = id;
    selectedYear = year;
    selectedMonth = month;
    const title = (year && month) ? `${id} - ${month} ${year}` : id;
    document.getElementById('modalAptoNum').innerText = title;
    modal.style.display = "block";
}

document.querySelector('.close').onclick = () => modal.style.display = "none";

paymentForm.onsubmit = (e) => {
    e.preventDefault();
    
    if (!selectedYear || !selectedMonth) {
        alert("Por favor seleccione un pago específico en la vista detallada.");
        modal.style.display = "none";
        return;
    }

    const amount = parseFloat(document.getElementById('payAmount').value);
    const apto = apartments.find(a => a.id === selectedAptoId);

    if (apto && !isNaN(amount)) {
        // Recalcular deuda para aplicar el pago correctamente (Interés + Capital)
        const currentMonthStr = currentMonthInput.value;
        const currentDate = new Date(currentMonthStr + "-01");
        const currentYear = currentDate.getFullYear();
        const currentMonthIdx = currentDate.getMonth();
        
        const yearInt = parseInt(selectedYear);
        const monthIdx = MONTH_NAMES.indexOf(selectedMonth);
        
        //let multiplier = 1;
        let total;
        let interest;
        let effectiveCapitalPayment;
        let interestPayment;
        
        // Verificar si aplica mora (lógica igual a renderTable)
        if (yearInt < currentYear || (yearInt === currentYear && monthIdx <= currentMonthIdx)) {
            const due = apto.debts[selectedYear]?.[selectedMonth] || 0;
            const paid = apto.payments[selectedYear]?.[selectedMonth] || 0;
            const partialPaid = apto.partials[selectedYear]?.[selectedMonth] || 0;

            //interestPayment = partialPaid;
            const balance = due - paid;

            if (balance > 0) {
                const monthsLate = (currentYear - yearInt) * 12 + (currentMonthIdx - monthIdx) + 1; // +1 para incluir el mes actual
                interest = 0;
                if (monthsLate > 0) {
                    interest = balance * LATE_FEE_RATE * monthsLate;
                }
                total = balance + interest - partialPaid;
            }
        }
        if(amount <= interest) {
            //effectiveCapitalPayment = 0;
            interestPayment = amount;
            apto.partials[selectedYear][selectedMonth] = (apto.partials[selectedYear][selectedMonth] || 0) + interestPayment;
            // Agregar la lógica para un abono que solo resta intereses. Esto producirá más lógica en otras funciones de arriba
        } else {
            effectiveCapitalPayment = amount - interest;
            apto.payments[selectedYear][selectedMonth] = (apto.payments[selectedYear][selectedMonth] || 0) + effectiveCapitalPayment;
        }
        
        localStorage.setItem('condoApartments', JSON.stringify(apartments));
        renderTable();
        checkAndShowResetButton();
        modal.style.display = "none";
        paymentForm.reset();
    }
};

// Eventos
currentMonthInput.addEventListener('change', renderTable);

// Botón para eliminar datos de LocalStorage
function checkAndShowResetButton() {
    if (localStorage.getItem('condoApartments') && !document.getElementById('resetDataBtn')) {
        const resetButton = document.createElement('button');
        resetButton.id = 'resetDataBtn';
        resetButton.innerText = "Eliminar Datos Locales";
        resetButton.style.cssText = "margin-top: 20px; background-color: #e74c3c; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; display: block;";
        resetButton.onclick = () => {
            if (confirm("¿Estás seguro de que deseas eliminar los datos guardados localmente? Esto revertirá a la base de datos original.")) {
                localStorage.removeItem('condoApartments');
                location.reload();
            }
        };
        (document.querySelector('.container') || document.body).appendChild(resetButton);
    }
}
checkAndShowResetButton();

// Inicio
loadDatabase();