let days = ['月', '火', '水', '木', '金', '土'];
let periods = [1, 2, 3, 4, 5];
const MAX_PER_SLOT = 2;
let isMenuEventsBound = false;

let blockedSlots = new Set(); // "月-1" の形式で保存

function getSlotKey(day, period) {
    return `${day}-${period}`;
}

function captureCardsBySlot(container) {
    const cardsBySlot = new Map();
    container.querySelectorAll('.drop-zone').forEach(zone => {
        const key = getSlotKey(zone.dataset.day, zone.dataset.period);
        const texts = [];
        zone.querySelectorAll('.card').forEach(card => texts.push(card.textContent));
        if (texts.length > 0) cardsBySlot.set(key, texts);
    });
    return cardsBySlot;
}

function init() {
    setupMenuEvents();
    renderDayHeader();
    renderEntryFormOptions();
    renderTable();
    renderSettingsGrid();
}

function toggleMoreMenu(event) {
    event.stopPropagation();
    const menu = document.getElementById('moreMenu');
    const toggle = document.querySelector('.menu-toggle');
    if (!menu || !toggle) return;

    const shouldOpen = menu.hasAttribute('hidden');
    if (shouldOpen) {
        menu.removeAttribute('hidden');
        toggle.setAttribute('aria-expanded', 'true');
    } else {
        closeMoreMenu();
    }
}

function closeMoreMenu() {
    const menu = document.getElementById('moreMenu');
    const toggle = document.querySelector('.menu-toggle');
    if (!menu || !toggle) return;
    menu.setAttribute('hidden', '');
    toggle.setAttribute('aria-expanded', 'false');
}

function setupMenuEvents() {
    if (isMenuEventsBound) return;

    document.addEventListener('click', (event) => {
        const menuWrap = document.querySelector('.menu-wrap');
        const menu = document.getElementById('moreMenu');
        if (!menuWrap || !menu || menu.hasAttribute('hidden')) return;
        if (!menuWrap.contains(event.target)) closeMoreMenu();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeMoreMenu();
    });

    isMenuEventsBound = true;
}

function renderDayHeader() {
    const headerRow = document.getElementById('dayHeaderRow');
    const dayHeaders = days.map(d => `<th>${d}</th>`).join('');
    headerRow.innerHTML = `<th style="width: 80px;">時限</th>${dayHeaders}`;
}

function renderEntryFormOptions() {
    const dayInput = document.getElementById('scheduleDay');
    const periodInput = document.getElementById('schedulePeriod');
    const currentDay = dayInput.value;
    const currentPeriod = periodInput.value;

    const nextDay = days.includes(currentDay) ? currentDay : days[0];
    const nextPeriod = periods.some(p => String(p) === currentPeriod) ? currentPeriod : String(periods[0]);

    dayInput.value = nextDay;
    periodInput.value = nextPeriod;

    renderEntryOptionButtons('scheduleDayButtons', days, (d) => `${d}`, nextDay, (value) => {
        dayInput.value = value;
    });
    renderEntryOptionButtons('schedulePeriodButtons', periods.map(String), (p) => `${p}限`, nextPeriod, (value) => {
        periodInput.value = value;
    });
}

function renderEntryOptionButtons(containerId, values, labelFormatter, selectedValue, onSelect) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    values.forEach((value) => {
        const button = document.createElement('button');
        const normalizedValue = String(value);
        button.type = 'button';
        button.className = 'option-button';
        button.dataset.value = normalizedValue;
        button.textContent = labelFormatter(value);

        if (normalizedValue === String(selectedValue)) {
            button.classList.add('active');
        }

        button.onclick = () => {
            container.querySelectorAll('.option-button').forEach((btn) => btn.classList.remove('active'));
            button.classList.add('active');
            onSelect(normalizedValue);
        };

        container.appendChild(button);
    });
}

function updateEntryOptionSelection(containerId, selectedValue) {
    const container = document.getElementById(containerId);
    container.querySelectorAll('.option-button').forEach((button) => {
        const isActive = button.dataset.value === String(selectedValue);
        button.classList.toggle('active', isActive);
    });
}

function renderTable() {
    const tbody = document.getElementById('tableBody');
    const existingCardsBySlot = captureCardsBySlot(tbody);
    const zoneBySlot = new Map();
    const fragment = document.createDocumentFragment();

    tbody.innerHTML = '';

    periods.forEach(p => {
        const tr = document.createElement('tr');

        const th = document.createElement('td');
        th.innerHTML = `<div class="period-header">${p}限</div>`;
        tr.appendChild(th);

        days.forEach(d => {
            const td = document.createElement('td');
            const zone = document.createElement('div');
            zone.className = 'drop-zone';
            zone.dataset.day = d;
            zone.dataset.period = p;

            const slotKey = getSlotKey(d, p);
            if (blockedSlots.has(slotKey)) {
                zone.classList.add('is-black');
            }
            zoneBySlot.set(slotKey, zone);

            zone.addEventListener('dragover', (e) => {
                const dragging = document.querySelector('.dragging');
                if (dragging && dragging.parentElement !== zone && zone.children.length >= MAX_PER_SLOT) return;
                e.preventDefault();
                zone.classList.add('over');
            });

            zone.addEventListener('dragleave', () => zone.classList.remove('over'));

            zone.addEventListener('drop', (e) => {
                zone.classList.remove('over');
                const dragging = document.querySelector('.dragging');
                if (dragging) {
                    if (dragging.parentElement !== zone && zone.children.length >= MAX_PER_SLOT) return;
                    zone.appendChild(dragging);
                    showToast("移動しました");
                }
            });

            td.appendChild(zone);
            tr.appendChild(td);
        });
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);

    existingCardsBySlot.forEach((texts, slotKey) => {
        const zone = zoneBySlot.get(slotKey);
        if (!zone) return;
        texts.slice(0, MAX_PER_SLOT).forEach(text => createCardElement(zone, text));
    });
}

function renderSettingsGrid() {
    const grid = document.getElementById('settingsGrid');
    grid.style.gridTemplateColumns = `60px repeat(${days.length}, 1fr)`;
    const htmlParts = ['<div></div>']; // 左上空白
    days.forEach(d => htmlParts.push(`<div>${d}</div>`));

    periods.forEach(p => {
        htmlParts.push(`<div>${p}限</div>`);
        days.forEach(d => {
            const key = getSlotKey(d, p);
            const checked = blockedSlots.has(key) ? 'checked' : '';
            htmlParts.push(`<div><input type="checkbox" ${checked} onchange="toggleBlock('${key}', this.checked)"></div>`);
        });
    });

    grid.innerHTML = htmlParts.join('');
}

function getValidSlotKeySet(targetDays, targetPeriods) {
    const validKeys = new Set();
    targetPeriods.forEach(p => targetDays.forEach(d => validKeys.add(getSlotKey(d, p))));
    return validKeys;
}

function openOptionsModal() {
    document.getElementById('optionDays').value = days.join(',');
    document.getElementById('optionPeriodCount').value = periods.length;
    document.getElementById('optionsModal').style.display = 'flex';
}

function applyOptions() {
    const rawDays = document.getElementById('optionDays').value;
    const periodCount = parseInt(document.getElementById('optionPeriodCount').value, 10);
    const nextDays = [...new Set(rawDays.split(',').map(v => v.trim()).filter(Boolean))];

    if (nextDays.length === 0) {
        alert('曜日を1つ以上入力してください');
        return;
    }

    if (!Number.isInteger(periodCount) || periodCount < 1 || periodCount > 10) {
        alert('時限数は1から10で入力してください');
        return;
    }

    const nextPeriods = Array.from({ length: periodCount }, (_, i) => i + 1);
    const currentCardsBySlot = captureCardsBySlot(document.getElementById('tableBody'));
    const nextValidKeys = getValidSlotKeySet(nextDays, nextPeriods);

    let removedCount = 0;
    currentCardsBySlot.forEach((texts, slotKey) => {
        if (!nextValidKeys.has(slotKey)) removedCount += texts.length;
    });

    if (removedCount > 0) {
        const ok = confirm(`変更後の範囲外になる予定が ${removedCount} 件あります。続行しますか？`);
        if (!ok) return;
    }

    days = nextDays;
    periods = nextPeriods;
    blockedSlots = new Set([...blockedSlots].filter(key => nextValidKeys.has(key)));

    renderDayHeader();
    renderEntryFormOptions();
    renderTable();
    renderSettingsGrid();
    closeModals();
    showToast('表示オプションを更新しました');
}

function toggleBlock(key, isChecked) {
    if (isChecked) {
        blockedSlots.add(key);
    } else {
        blockedSlots.delete(key);
    }
    renderTable();
}

// Modal Operations
function openEntryModal(card = null) {
    const modal = document.getElementById('entryModal');
    const title = document.getElementById('entryModalTitle');
    const delBtn = document.getElementById('deleteBtn');

    if (card) {
        title.textContent = "予定の編集";
        document.getElementById('scheduleText').value = card.textContent;
        document.getElementById('scheduleDay').value = card.parentElement.dataset.day;
        document.getElementById('schedulePeriod').value = card.parentElement.dataset.period;
        updateEntryOptionSelection('scheduleDayButtons', card.parentElement.dataset.day);
        updateEntryOptionSelection('schedulePeriodButtons', card.parentElement.dataset.period);
        document.getElementById('editCardId').value = "editing";
        card.id = "target-edit";
        delBtn.style.display = "block";
    } else {
        title.textContent = "予定の追加";
        document.getElementById('scheduleText').value = "";
        document.getElementById('scheduleDay').value = days[0];
        document.getElementById('schedulePeriod').value = String(periods[0]);
        updateEntryOptionSelection('scheduleDayButtons', days[0]);
        updateEntryOptionSelection('schedulePeriodButtons', String(periods[0]));
        document.getElementById('editCardId').value = "";
        delBtn.style.display = "none";
    }
    modal.style.display = 'flex';
}

function openSettingsModal() {
    document.getElementById('settingsModal').style.display = 'flex';
}

function closeModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
    const editing = document.getElementById('target-edit');
    if (editing) editing.id = "";
}

function saveSchedule() {
    const text = document.getElementById('scheduleText').value.trim();
    const day = document.getElementById('scheduleDay').value;
    const period = document.getElementById('schedulePeriod').value;
    const isEdit = document.getElementById('editCardId').value === "editing";

    if (!text) {
        alert("内容を入力してください");
        return;
    }

    const slotKey = `${day}-${period}`;
    if (blockedSlots.has(slotKey)) {
        alert("その時間は休みに設定されています");
        return;
    }

    const targetZone = document.querySelector(`.drop-zone[data-day="${day}"][data-period="${period}"]`);
    const editingCard = document.getElementById('target-edit');

    // 個数チェック（編集で同じ場所ならOK、違う場所ならチェック）
    const currentCount = targetZone.children.length;
    if (!isEdit && currentCount >= MAX_PER_SLOT) {
        alert("このコマはすでに満杯です（最大2件）");
        return;
    }
    if (isEdit && editingCard.parentElement !== targetZone && currentCount >= MAX_PER_SLOT) {
        alert("移動先のコマはすでに満杯です（最大2件）");
        return;
    }

    if (isEdit && editingCard) {
        editingCard.textContent = text;
        targetZone.appendChild(editingCard);
        editingCard.id = "";
        showToast("編集しました");
    } else {
        createCardElement(targetZone, text);
        showToast("追加しました");
    }

    closeModals();
}

function createCardElement(parent, text) {
    const card = document.createElement('div');
    card.className = 'card';
    card.draggable = true;
    card.textContent = text;

    card.onclick = () => openEntryModal(card);

    card.ondragstart = (e) => {
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', '');
    };
    card.ondragend = () => card.classList.remove('dragging');

    parent.appendChild(card);
}

function deleteCurrentCard() {
    const card = document.getElementById('target-edit');
    if (card && confirm("削除しますか？")) {
        card.remove();
        closeModals();
        showToast("削除しました");
    }
}

// CSV
function exportCSV() {
    let csv = "\uFEFFPeriod,Day,Content,IsBlocked\n";
    document.querySelectorAll('.drop-zone').forEach(z => {
        const isBlocked = blockedSlots.has(`${z.dataset.day}-${z.dataset.period}`) ? 1 : 0;
        const cards = z.querySelectorAll('.card');
        if (cards.length > 0) {
            cards.forEach(c => {
                csv += `${z.dataset.period},${z.dataset.day},"${c.textContent}",${isBlocked}\n`;
            });
        } else {
            csv += `${z.dataset.period},${z.dataset.day},"",${isBlocked}\n`;
        }
    });
    const blob = new Blob([csv], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'schedule.csv'; a.click();
}

function importCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const lines = event.target.result.split('\n').slice(1);
        blockedSlots.clear();
        renderTable(); // 一旦クリア
        lines.forEach(line => {
            if (!line.trim()) return;
            const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            const p = parts[0].trim();
            const d = parts[1].trim();
            const text = parts[2].replace(/"/g, '').trim();
            const block = parseInt(parts[3]);

            const key = `${d}-${p}`;
            if (block === 1) blockedSlots.add(key);

            const zone = document.querySelector(`.drop-zone[data-day="${d}"][data-period="${p}"]`);
            if (zone) {
                if (block === 1) zone.classList.add('is-black');
                if (text) createCardElement(zone, text);
            }
        });
        renderSettingsGrid();
        showToast("読み込み完了");
    };
    reader.readAsText(file);
}

function resetAll() {
    if (confirm("すべてクリアしますか？")) {
        blockedSlots.clear();
        init();
        showToast("リセットしました");
    }
}

function showToast(msg) {
    const t = document.getElementById('statusMessage');
    t.textContent = msg; t.style.display = 'block';
    setTimeout(() => t.style.display = 'none', 2000);
}

window.onload = init;
