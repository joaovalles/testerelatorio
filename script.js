// Importações do Firebase SDK Modular
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, updatePassword } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

// Credenciais Firebase
const firebaseConfig = {
    apiKey: "AIzaSyA20u249HTh7osBExNRznpd6UmQzqmTZRY",
    authDomain: "relatorio-30h.firebaseapp.com",
    projectId: "relatorio-30h",
    storageBucket: "relatorio-30h.firebasestorage.app",
    messagingSenderId: "315379117754",
    appId: "1:315379117754:web:e1847977fc374239575c83",
    measurementId: "G-G0PKYYG4JL"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const reportsCollection = collection(db, 'relatorios');

// =============================================================
// =============== UTILS & CORE SYSTEM =========================
// =============================================================

const listaChavesPedido = ['pedido', 'idvenda', 'id_venda', 'id venda', 'número do pedido', 'numero do pedido', 'nº pedido'];

function findKeyByKeywords(obj, keywords) {
    const keys = Object.keys(obj);
    for (let k of keys) if (keywords.includes(k)) return k;
    for (let k of keys) for (let kw of keywords) if (k.includes(kw)) return k;
    return null;
}

// Utilitário para DOM
const $ = (id) => document.getElementById(id);

onAuthStateChanged(auth, (user) => {
    if (user) {
        $('loginScreen').classList.add('hidden');
        $('top-nav').classList.remove('hidden');
        switchGlobalModule('module-logistica');
    } else {
        $('loginScreen').classList.remove('hidden');
        $('top-nav').classList.add('hidden');
        $('module-logistica').classList.add('hidden');
        $('module-ra').classList.add('hidden');
    }
});

window.fazerLogin = async function() {
    const email = $('emailInput').value;
    const pass = $('passwordInput').value;
    const btn = $('btnLogin');
    if(!email || !pass) return;
    btn.innerText = "Verificando...";
    $('loginError').classList.add('hidden');
    try { await signInWithEmailAndPassword(auth, email, pass); } 
    catch (error) { $('loginError').classList.remove('hidden'); } 
    finally { btn.innerText = "Entrar"; }
}

window.fazerLogout = function() {
    signOut(auth).then(() => { $('emailInput').value = ''; $('passwordInput').value = ''; });
}

window.alterarSenha = async function() {
    const newPass = $('newPasswordInput').value;
    const confirmPass = $('confirmPasswordInput').value;
    const msg = $('passwordMsg');
    msg.classList.remove('hidden', 'text-red-600', 'text-green-600');
    
    if (!newPass || newPass.length < 6) { msg.innerText = "Mínimo 6 caracteres."; msg.classList.add('text-red-600'); return; }
    if (newPass !== confirmPass) { msg.innerText = "Senhas não coincidem."; msg.classList.add('text-red-600'); return; }
    
    if (auth.currentUser) {
        try {
            await updatePassword(auth.currentUser, newPass);
            msg.innerText = "Senha alterada!"; msg.classList.add('text-green-600');
            $('newPasswordInput').value = ''; $('confirmPasswordInput').value = '';
        } catch (error) {
            msg.innerText = "Erro ao alterar. Saia e entre novamente."; msg.classList.add('text-red-600');
        }
    }
}

window.switchGlobalModule = function(moduleId) {
    $('module-logistica').classList.add('hidden');
    $('module-ra').classList.add('hidden');
    $('gnav-logistica').className = "px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition";
    $('gnav-ra').className = "px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition";

    $(moduleId).classList.remove('hidden');
    const activeBtn = moduleId === 'module-logistica' ? $('gnav-logistica') : $('gnav-ra');
    activeBtn.className = "px-3 py-2 rounded-md text-sm font-medium bg-gray-800 text-white transition shadow";
}

// =============================================================
// ================= MÓDULO 1: LOGÍSTICA (30h+) ================
// =============================================================

const tableConfig = [
    { status: 'FATURADO (SC)', setor: 'ESTOQUE SC' }, { status: 'EM SEPARAÇÃO (SC)', setor: 'ESTOQUE SC' },
    { status: 'AGUARDANDO COLETA (SC)', setor: 'ESTOQUE SC' }, { status: 'VERIFICADO (SC)', setor: 'ESTOQUE SC' },
    { status: 'HD BRASIL ESTÁ MONTANDO SUA MÁQUINA (SC)', setor: 'ESTOQUE SC' }, { status: 'PAGAMENTO APROVADO (SC)', setor: 'ESTOQUE SC' },
    { status: 'EM PROCESSAMENTO (SC)', setor: 'ESTOQUE SC' }, { status: 'PENDENTE TROCA (SC)', setor: 'ESTOQUE SC' },
    { status: 'AGUARDANDO REVISÃO (SC)', setor: 'ATENDIMENTO' }, { status: 'RETIDO (SC)', setor: 'ATENDIMENTO' },
    { status: 'AGUARDANDO DISPONIBILIDADE (SC)', setor: 'ATENDIMENTO' }, { status: 'INCOMPATÍVEL (SC)', setor: 'ATENDIMENTO' },
    { status: 'PENDENTE REEMBOLSO (SC)', setor: 'ATENDIMENTO' }
];

let currentCounts = {};
let sectorOrders = {}; 
let chartInstanceSector = null;
let chartInstanceStatus = null;
let historyCache = []; 
let currentTeamMessage = ""; 

function initCounts() {
    tableConfig.forEach(item => { currentCounts[item.status] = 0; sectorOrders[item.setor] = []; });
}
initCounts();

window.switchTab = function(tabId) {
    ['tab-analise', 'tab-historico', 'tab-conta'].forEach(id => $(id).classList.add('hidden'));
    ['nav-analise', 'nav-historico', 'nav-conta'].forEach(id => $(id).classList.remove('active'));
    $(tabId).classList.remove('hidden');
    $('nav-' + tabId.split('-')[1]).classList.add('active');
    if(tabId === 'tab-historico') fetchHistoryFromFirebase();
}

window.handleFileUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const sheetName = workbook.SheetNames[0];
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "", raw: false, dateNF: 'dd/mm/yyyy' });
        processNewData(jsonData);
    };
    reader.readAsArrayBuffer(file);
    event.target.value = ''; 
}

function processNewData(data) {
    initCounts();
    data.forEach(row => {
        const rowNorm = {}; for(let key in row) rowNorm[key.trim().toLowerCase()] = row[key];
        
        const kPedido = findKeyByKeywords(rowNorm, listaChavesPedido);
        const idPedido = kPedido ? rowNorm[kPedido].toString().trim() : '';
        const statusStr = (rowNorm['status'] || '').toString().trim().toUpperCase();
        const dataStr = rowNorm['datahora'] || rowNorm['data'] || rowNorm['data do pedido'] || rowNorm['criado em'] || '-';
        
        if(!idPedido && statusStr === '') return;
        for (let config of tableConfig) {
            if (statusStr.includes(config.status) || config.status.includes(statusStr)) {
                currentCounts[config.status]++;
                sectorOrders[config.setor].push({ data: dataStr, pedido: idPedido, status: statusStr });
                break;
            }
        }
    });

    $('currentReportLabel').innerText = "Relatório em exibição: Nova análise (Não salva na nuvem)";
    $('btnSave').classList.remove('hidden');
    updateLogisticaDashboard();
    window.switchTab('tab-analise');
}

function updateLogisticaDashboard() {
    $('emptyState').classList.add('hidden');
    $('uiArea').classList.remove('hidden');
    $('uiArea').classList.add('flex');
    renderLogisticaTable();
    generateTextForTeam(); 
    renderLogisticaCharts();
    renderSectorDetails(); 
}

function renderLogisticaTable() {
    const tbody = $('tableBody');
    tbody.innerHTML = '';
    tableConfig.forEach(config => {
        tbody.innerHTML += `<tr><td>${config.status}</td><td>${config.setor}</td><td class="font-bold text-lg">${currentCounts[config.status]}</td></tr>`;
    });
}

function generateTextForTeam() {
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    let texto = `Bom dia meus consagrados!\n\nSegue relação de 30+ para avaliação, retirado as ${hora}, podem ter ocorrido atualizações!\n\nEstoque SC @Mario Tobal Se precisar de uma mão só avisar!\n\n`;
    tableConfig.forEach(c => { if (c.setor === 'ESTOQUE SC' && currentCounts[c.status] > 0) texto += `${c.status}    ${currentCounts[c.status]}\n`; });
    texto += `\nATENDIMENTO - Já em validação...\n\n`;
    tableConfig.forEach(c => { if (c.setor === 'ATENDIMENTO' && currentCounts[c.status] > 0) texto += `${c.status}    ${currentCounts[c.status]}\n`; });
    texto += `\nSegue planilha para acompanhamento:\nRELATÓRIO 30+`;
    currentTeamMessage = texto;
}

window.copyText = function() {
    navigator.clipboard.writeText(currentTeamMessage).then(() => {
        $('copyMsg').classList.remove('hidden'); setTimeout(() => $('copyMsg').classList.add('hidden'), 3000);
    });
}

function renderLogisticaCharts() {
    if (chartInstanceSector) chartInstanceSector.destroy();
    if (chartInstanceStatus) chartInstanceStatus.destroy();

    let scTotal = 0, atTotal = 0;
    tableConfig.forEach(c => { c.setor === 'ESTOQUE SC' ? scTotal += currentCounts[c.status] : atTotal += currentCounts[c.status]; });

    chartInstanceSector = new Chart($('sectorChart').getContext('2d'), { 
        type: 'doughnut', 
        data: { labels: ['Estoque SC', 'Atendimento'], datasets: [{ data: [scTotal, atTotal], backgroundColor: ['#2563eb', '#16a34a'] }] }, 
        options: { responsive: true, maintainAspectRatio: false } 
    });

    const statusLabels = [], statusData = [];
    tableConfig.forEach(c => { if (currentCounts[c.status] > 0) { statusLabels.push(c.status.replace(' (SC)', '')); statusData.push(currentCounts[c.status]); }});

    chartInstanceStatus = new Chart($('statusChart').getContext('2d'), { 
        type: 'bar', 
        data: { labels: statusLabels, datasets: [{ label: 'Qtd de Pedidos', data: statusData, backgroundColor: '#f59e0b', borderRadius: 4 }] }, 
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } } 
    });
}

function renderSectorDetails() {
    const container = $('sectorDetailsContainer'); container.innerHTML = ''; 
    [...new Set(tableConfig.map(c => c.setor))].forEach(setor => {
        const orders = sectorOrders[setor] || [];
        if (orders.length === 0) return; 
        
        let rowsHtml = '';
        orders.forEach(o => rowsHtml += `<tr class="border-b hover:bg-gray-50"><td class="p-3 border">${o.data}</td><td class="p-3 border font-mono font-bold">${o.pedido}</td><td class="p-3 border text-xs">${o.status}</td></tr>`);
        
        container.innerHTML += `
            <div class="bg-white p-6 rounded-lg shadow-md border border-gray-300 mt-4">
                <div class="flex justify-between items-center mb-4 border-b pb-3">
                    <h3 class="text-xl font-bold">Detalhamento: ${setor}</h3>
                    <button onclick="copySectorData('${setor}')" class="bg-gray-800 text-white px-4 py-2 rounded text-sm font-bold">📋 Copiar (${orders.length})</button>
                </div>
                <div class="overflow-x-auto max-h-96"><table class="w-full text-sm">
                <thead class="bg-gray-200 sticky top-0"><tr><th class="p-3 text-left">Data</th><th class="p-3 text-left">Pedido</th><th class="p-3 text-left">Status</th></tr></thead>
                <tbody>${rowsHtml}</tbody></table></div>
            </div>`;
    });
}

window.copySectorData = function(setor) {
    const orders = sectorOrders[setor] || [];
    let tsvData = "Data\tPedido\tStatus\n";
    orders.forEach(o => tsvData += `${o.data}\t${o.pedido}\t${o.status}\n`);
    navigator.clipboard.writeText(tsvData).then(() => alert(`Copiado!`));
}

window.saveCurrentReport = async function() {
    let total = Object.values(currentCounts).reduce((a,b)=>a+b,0);
    const reportData = { timestamp: new Date().getTime(), dateLabel: new Date().toLocaleString('pt-BR'), total: total, createdBy: auth.currentUser ? auth.currentUser.email : "Desconhecido", counts: currentCounts, orders: sectorOrders };
    $('btnSave').innerText = "Salvando..."; $('btnSave').disabled = true;
    try {
        await addDoc(reportsCollection, reportData);
        alert("Salvo!"); $('btnSave').classList.add('hidden'); $('currentReportLabel').innerText = `Salvo em ${reportData.dateLabel}`;
    } catch (e) { alert("Erro ao salvar."); } finally { $('btnSave').innerText = "💾 Salvar no Firebase"; $('btnSave').disabled = false; }
}

async function fetchHistoryFromFirebase() {
    try {
        const querySnapshot = await getDocs(query(reportsCollection, orderBy("timestamp", "desc")));
        historyCache = []; querySnapshot.forEach(doc => historyCache.push({ id: doc.id, ...doc.data() }));
        renderHistoryTable();
    } catch (e) { $('historyTableBody').innerHTML = '<tr><td colspan="4">Erro na busca.</td></tr>'; }
}

function renderHistoryTable() {
    const tbody = $('historyTableBody'); tbody.innerHTML = '';
    if(historyCache.length === 0) { tbody.innerHTML = `<tr><td colspan="4" class="text-center">Vazio.</td></tr>`; return; }
    historyCache.forEach(item => {
        tbody.innerHTML += `<tr><td class="p-3">${item.dateLabel}</td><td class="p-3 text-center">${item.total}</td><td class="p-3">${item.createdBy}</td><td class="p-3 text-center"><button onclick="loadReport('${item.id}')" class="bg-blue-600 text-white px-3 py-1 rounded">Visualizar</button> <button onclick="deleteReport('${item.id}')" class="bg-red-500 text-white px-3 py-1 rounded">Excluir</button></td></tr>`;
    });
}

window.loadReport = function(id) {
    const report = historyCache.find(r => r.id === id);
    if(report) {
        currentCounts = report.counts; sectorOrders = report.orders || {}; 
        $('currentReportLabel').innerText = `Histórico: ${report.dateLabel}`;
        $('btnSave').classList.add('hidden'); 
        updateLogisticaDashboard(); window.switchTab('tab-analise');
    }
}

window.deleteReport = async function(id) {
    if(confirm(`Tem certeza que deseja excluir?`)) {
        await deleteDoc(doc(db, "relatorios", id)); fetchHistoryFromFirebase();
    }
}

window.generatePDF = function() {
    window.scrollTo(0, 0); 
    const total = Object.values(currentCounts).reduce((a,b)=>a+b,0);
    $('executiveAnalysis').innerHTML = `<p>O cenário atual reporta um acumulado de <strong>${total} pedidos</strong> com tempo de permanência superior a 30 horas.</p>`;
    
    let tableHTML = `<thead><tr><th>Status</th><th>Setor Responsável</th><th>QTD</th></tr></thead><tbody>`;
    tableConfig.forEach(c => tableHTML += `<tr><td>${c.status}</td><td>${c.setor}</td><td style="font-weight: bold;">${currentCounts[c.status]}</td></tr>`);
    $('pdfTable').innerHTML = tableHTML + `</tbody>`;
    $('pdfDate').innerText = `Documento referente a: ${new Date().toLocaleString()}`;
    
    document.body.classList.add('is-printing');
    html2pdf().set({ margin: 15, filename: `Analise.pdf`, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } })
    .from($('pdfContent')).save().then(() => document.body.classList.remove('is-printing'));
}

// =============================================================
// ================= MÓDULO 2: RECLAME AQUI ====================
// =============================================================

let raDataAll = []; 
let currentVisibleTableData = []; 

// Instâncias de Gráficos RA
let raScoreChartInstance = null; 
let raCategoryChartInstance = null;    
let raTrendChartInstance = null; // NOVO: Evolução Temporal

// ERP Maps
let erpDataMap = {}; 
let erpStateChartInstance = null;
let erpPayChartInstance = null;

function setRADefaultDates() {
    const today = new Date();
    const sevenAgo = new Date(); sevenAgo.setDate(today.getDate() - 7);
    const format = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    
    if ($('raStartDate') && $('raEndDate')) {
        $('raStartDate').value = format(sevenAgo);
        $('raEndDate').value = format(today);
    }
}
setRADefaultDates();

function parseRADateObj(dateStr) {
    if(!dateStr || dateStr === '-' || dateStr === '' || dateStr.toString().toUpperCase() === 'NÃO INFORMADO') return null;
    try {
        const parts = dateStr.toString().split(' ')[0].split(/[\/\-]/); 
        const dateObj = parts[0].length === 4 ? new Date(parts[0], parts[1]-1, parts[2]) : new Date(parts[2], parts[1]-1, parts[0]);
        return isNaN(dateObj.getTime()) ? null : dateObj;
    } catch(e) { return null; }
}

window.handleRAFileUpload = function(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        const wb = XLSX.read(new Uint8Array(e.target.result), {type: 'array'});
        processRAData(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: false, dateNF: 'dd/mm/yyyy' }));
    };
    reader.readAsArrayBuffer(file); event.target.value = ''; 
}

function processRAData(data) {
    raDataAll = [];

    data.forEach(row => {
        const rN = {}; for(let key in row) rN[key.trim().toLowerCase()] = row[key];

        const kAbertura = findKeyByKeywords(rN, ['entrada', 'data de abertura', 'criado']);
        const kRespondido = findKeyByKeywords(rN, ['data da resposta', 'respondida em']);
        const kPedido = findKeyByKeywords(rN, listaChavesPedido);
        const kTicket = findKeyByKeywords(rN, ['ticket']);
        const kID = findKeyByKeywords(rN, ['id']);
        const kCliente = findKeyByKeywords(rN, ['cliente', 'nome do consumidor']);
        const kStatus = findKeyByKeywords(rN, ['situação', 'status']);
        const kNota = findKeyByKeywords(rN, ['nota', 'avaliação']);
        const kCategoria = findKeyByKeywords(rN, ['categoria', 'motivo', 'assunto']);

        let notaVal = kNota ? rN[kNota].toString().trim().toUpperCase() : '';
        if (['NÃO INFORMADO', 'NAN', '-', '', 'N/I', 'N/A', 'NULL'].includes(notaVal)) notaVal = '';
        else notaVal = isNaN(parseInt(notaVal)) ? '' : parseInt(notaVal).toString();

        raDataAll.push({
            abertura: kAbertura ? rN[kAbertura].toString().trim() : '-',
            dataAberturaObj: parseRADateObj(kAbertura ? rN[kAbertura].toString() : ''), 
            respondido: kRespondido ? rN[kRespondido].toString().trim() : '-',
            pedido: kPedido ? rN[kPedido].toString().trim() : '-',
            ticket: kTicket ? rN[kTicket].toString().trim() : '-', 
            idRA: kID ? rN[kID].toString().trim() : '-', 
            cliente: kCliente ? rN[kCliente].toString().trim() : '-',
            status: kStatus ? rN[kStatus].toString().trim() : 'Sem Status',
            nota: notaVal,
            categoria: kCategoria ? rN[kCategoria].toString().trim() : 'Não categorizado'
        });
    });

    const categorySelect = $('raCategoryFilter');
    if (categorySelect) {
        let uniqueCats = [...new Set(raDataAll.map(i => i.categoria))].filter(c => c !== '').sort();
        let catHtml = '<option value="all">Filtro: Todos os Motivos</option>';
        uniqueCats.forEach(c => catHtml += `<option value="${c}">${c}</option>`);
        categorySelect.innerHTML = catHtml;
    }

    setRADefaultDates();
    $('emptyStateRA').classList.add('hidden');
    $('uiAreaRA').classList.remove('hidden');
    $('uiAreaRA').classList.add('flex');
    window.filterRADashboard(); 
}

// A FUNÇÃO PRINCIPAL QUE RODA SEMPRE QUE ALGUÉM FILTRA ALGO
window.filterRADashboard = function() { updateRATable(); }

// CENTRAL DE ATUALIZAÇÃO DO RA (Filtra, Tabela e Gráficos)
window.updateRATable = function() {
    const startVal = $('raStartDate').value;
    const endVal = $('raEndDate').value;
    const statFilter = $('raTableFilter') ? $('raTableFilter').value : 'all';
    const scoFilter = $('raScoreFilter') ? $('raScoreFilter').value : 'all';
    const catFilter = $('raCategoryFilter') ? $('raCategoryFilter').value : 'all';

    let fd = raDataAll;

    // 1. Aplica Datas
    if (startVal) fd = fd.filter(r => r.dataAberturaObj && r.dataAberturaObj >= new Date(startVal + 'T00:00:00'));
    if (endVal) fd = fd.filter(r => r.dataAberturaObj && r.dataAberturaObj <= new Date(endVal + 'T23:59:59'));

    // 2. Aplica Dropdowns
    if (statFilter === 'avaliadas') fd = fd.filter(r => r.nota !== '');
    else if (statFilter === 'respondidas') fd = fd.filter(r => r.status.toLowerCase().includes('respondid'));
    else if (statFilter === 'excluidas') fd = fd.filter(r => r.status.toLowerCase().includes('excluíd') || r.status.toLowerCase().includes('desativada'));

    if (scoFilter !== 'all') fd = fd.filter(r => String(r.nota).trim() === String(scoFilter).trim());
    if (catFilter !== 'all') fd = fd.filter(r => r.categoria === catFilter);

    currentVisibleTableData = fd;

    // ==========================================
    // ATUALIZA KPIs E GRÁFICOS DO RA
    // ==========================================
    let cResp=0, cAval=0, cReso=0, cExcl=0;
    let catZero={}, scoCounts={}, critItems=[];
    let monthlyCounts = {}; // NOVO: Pra evolução temporal

    fd.forEach(item => {
        const st = item.status.toLowerCase();
        if(st.includes('respondid')) cResp++;
        if(item.nota !== '') { cAval++; scoCounts[item.nota] = (scoCounts[item.nota] || 0) + 1; }
        if(st.includes('resolvid')) cReso++;
        if(st.includes('excluíd') || st.includes('desativada')) cExcl++;

        if(item.nota === '0' || st.includes('não resolvid')) {
            catZero[item.categoria] = (catZero[item.categoria] || 0) + 1;
            critItems.push(item);
        }

        // NOVO: Agrupa por Mês/Ano para a Evolução Temporal
        if(item.dataAberturaObj) {
            let m = String(item.dataAberturaObj.getMonth() + 1).padStart(2, '0');
            let y = item.dataAberturaObj.getFullYear();
            let key = `${y}-${m}`; // YYYY-MM garante ordenação correta
            monthlyCounts[key] = (monthlyCounts[key] || 0) + 1;
        }
    });

    $('raKpiAbertas').innerText = fd.length; $('raKpiRespondidas').innerText = cResp;
    $('raKpiAvaliadas').innerText = cAval; $('raKpiResolvidas').innerText = cReso;
    $('raKpiExcluidas').innerText = cExcl;

    // Gráfico de Notas
    if(raScoreChartInstance) raScoreChartInstance.destroy();
    const scoreLabels = ['0','1','2','3','4','5','6','7','8','9','10'];
    raScoreChartInstance = new Chart($('raScoreChart').getContext('2d'), {
        type: 'bar',
        data: { labels: scoreLabels, datasets: [{ data: scoreLabels.map(l => scoCounts[l] || 0), backgroundColor: scoreLabels.map(l=>parseInt(l)<=3?'#ef4444':parseInt(l)<=6?'#eab308':'#22c55e'), borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });

    // Gráfico Categoria (Zeros)
    if(raCategoryChartInstance) raCategoryChartInstance.destroy();
    const catLabels = Object.keys(catZero);
    raCategoryChartInstance = new Chart($('raCategoryChart').getContext('2d'), {
        type: 'bar',
        data: { labels: catLabels.length ? catLabels : ['Sem notas 0'], datasets: [{ data: catLabels.length ? Object.values(catZero) : [0], backgroundColor: '#ef4444', borderRadius: 4 }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    // Lista Crítica
    $('raCriticalList').innerHTML = critItems.length === 0 ? `<p class="text-green-600 font-bold text-center mt-4">Nenhuma avaliação crítica encontrada! 🎉</p>` : 
    critItems.map(c => `<div class="bg-white p-3 mb-2 rounded border border-red-100 shadow-sm"><div class="flex justify-between mb-1"><span class="font-bold text-xs">ID: ${c.idRA}</span><span class="bg-red-100 text-red-800 text-xs font-bold px-2 py-0.5 rounded">Nota: ${c.nota || 'S/N'}</span></div><p class="text-xs text-gray-600 truncate">${c.cliente}</p><p class="text-xs text-gray-500 font-bold mt-1">Motivo: ${c.categoria}</p></div>`).join('');

    // ==========================================
    // NOVO: GRÁFICO EVOLUÇÃO MENSAL
    // ==========================================
    if(raTrendChartInstance) raTrendChartInstance.destroy();
    
    const sortedMonths = Object.keys(monthlyCounts).sort();
    const trendLabels = sortedMonths.map(k => {
        let [y, m] = k.split('-'); return `${m}/${y}`; // Exibe MM/YYYY
    });
    const trendData = sortedMonths.map(k => monthlyCounts[k]);

    raTrendChartInstance = new Chart($('raTrendChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: trendLabels.length ? trendLabels : ['Sem dados'],
            datasets: [{
                label: 'Volume de Reclamações',
                data: trendLabels.length ? trendData : [0],
                borderColor: '#9333ea', // Roxo RA
                backgroundColor: 'rgba(147, 51, 234, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#9333ea',
                pointRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });

    // ==========================================
    // ATUALIZA TABELA DETALHADA
    // ==========================================
    const tbody = $('raTableBody');
    if (fd.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-gray-500 font-bold">Nenhum registro encontrado para esta combinação.</td></tr>`;
    } else {
        let html = '';
        fd.forEach(r => {
            let badge = r.nota === '' ? `<span class="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs font-bold">N/I</span>` : `<span class="${parseInt(r.nota)>=7?'bg-green-200 text-green-800':parseInt(r.nota)<=3?'bg-red-200 text-red-800':'bg-yellow-200 text-yellow-800'} px-2 py-1 rounded text-xs font-bold">${r.nota}</span>`;
            html += `<tr class="border-b hover:bg-gray-50">
                        <td class="p-2 border text-xs">${r.abertura !== '-' ? r.abertura.toString().split(' ')[0] : '-'}</td>
                        <td class="p-2 border text-xs text-blue-700 font-semibold">${r.respondido !== '-' ? r.respondido.toString().split(' ')[0] : '-'}</td>
                        <td class="p-2 border font-mono font-bold text-xs">${r.pedido}</td>
                        <td class="p-2 border font-mono font-bold text-indigo-600">${r.ticket}</td>
                        <td class="p-2 border font-mono font-bold text-purple-700">${r.idRA}</td>
                        <td class="p-2 border max-w-[150px] truncate" title="${r.cliente}">${r.cliente}</td>
                        <td class="p-2 border text-xs font-semibold text-gray-600 uppercase">${r.status}</td>
                        <td class="p-2 border text-center">${badge}</td>
                        <td class="p-2 border text-xs">${r.categoria}</td>
                    </tr>`;
        });
        tbody.innerHTML = html;
    }
    
    updateERPDashboard();
}

window.copyRATableData = function() {
    if(currentVisibleTableData.length === 0) { alert("Não há dados!"); return; }
    let tsv = "Data Abertura\tData Resposta\tPedido\tTicket\tID\tCliente\tStatus\tNota\tCategoria\n";
    currentVisibleTableData.forEach(r => tsv += `${r.abertura.split(' ')[0]}\t${r.respondido.split(' ')[0]}\t${r.pedido}\t${r.ticket}\t${r.idRA}\t${r.cliente}\t${r.status}\t${r.nota || 'N/I'}\t${r.categoria}\n`);
    navigator.clipboard.writeText(tsv).then(() => alert("Copiado!"));
}

window.copyRAColumn = function(colKey) {
    if(currentVisibleTableData.length === 0) { alert("Não há dados!"); return; }
    let text = "";
    currentVisibleTableData.forEach(r => {
        let val = (colKey === 'abertura' || colKey === 'respondido') ? r[colKey].split(' ')[0] : colKey === 'nota' ? (r.nota || 'N/I') : r[colKey];
        text += `${val}\n`;
    });
    navigator.clipboard.writeText(text).then(() => alert("Coluna copiada!"));
}

// =============================================================
// ================= CRUZAMENTO ERP (TRANSPORTADORA) ===========
// =============================================================

window.handleERPFileUpload = function(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        const wb = XLSX.read(new Uint8Array(e.target.result), {type: 'array'});
        processERPData(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: false }));
    };
    reader.readAsArrayBuffer(file); event.target.value = ''; 
}

function processERPData(data) {
    erpDataMap = {}; let found = 0;
    data.forEach(row => {
        const rN = {}; for(let k in row) rN[k.trim().toLowerCase()] = row[k];
        const kPedido = findKeyByKeywords(rN, listaChavesPedido);
        const kEstado = findKeyByKeywords(rN, ['estado', 'uf', 'província']);
        const kPag = findKeyByKeywords(rN, ['formapagamento', 'pagamento', 'forma de pagamento']);

        if (kPedido && kEstado && rN[kPedido].toString().trim()) {
            erpDataMap[rN[kPedido].toString().trim()] = { 
                estado: rN[kEstado].toString().trim().toUpperCase(), 
                pagamento: kPag ? rN[kPag].toString().trim() : 'NÃO ESPECIFICADO' 
            };
            found++;
        }
    });

    if (found === 0) { alert("Não encontramos 'Pedido' e 'Estado' na planilha ERP."); return; }
    $('emptyStateERP').classList.add('hidden');
    $('uiAreaERP').classList.remove('hidden'); $('uiAreaERP').classList.add('flex');
    updateERPDashboard();
}

function updateERPDashboard() {
    if (Object.keys(erpDataMap).length === 0) return;

    let stateCounts = {}, payCounts = {}, catStateCounts = {};

    currentVisibleTableData.forEach(row => {
        if(row.pedido && row.pedido !== '-') {
            let erp = erpDataMap[row.pedido] || { estado: 'NÃO ENCONTRADO NO ERP', pagamento: 'NÃO ENCONTRADO NO ERP' };
            let cat = row.categoria || 'Sem categoria';
            
            stateCounts[erp.estado] = (stateCounts[erp.estado] || 0) + 1;
            payCounts[erp.pagamento] = (payCounts[erp.pagamento] || 0) + 1;
            if(!catStateCounts[cat]) catStateCounts[cat] = {};
            catStateCounts[cat][erp.estado] = (catStateCounts[cat][erp.estado] || 0) + 1;
        }
    });

    // Gráficos ERP
    const sortedSt = Object.keys(stateCounts).sort((a,b) => stateCounts[b] - stateCounts[a]).slice(0,10);
    if(erpStateChartInstance) erpStateChartInstance.destroy();
    erpStateChartInstance = new Chart($('erpStateChart').getContext('2d'), {
        type: 'bar', data: { labels: sortedSt, datasets: [{ data: sortedSt.map(s => stateCounts[s]), backgroundColor: '#6366f1', borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    if(erpPayChartInstance) erpPayChartInstance.destroy();
    erpPayChartInstance = new Chart($('erpPayChart').getContext('2d'), {
        type: 'doughnut', data: { labels: Object.keys(payCounts), datasets: [{ data: Object.values(payCounts), backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'] }] },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Tabela ERP
    const sortedCats = Object.keys(catStateCounts).sort((a, b) => Object.values(catStateCounts[b]).reduce((x,y)=>x+y,0) - Object.values(catStateCounts[a]).reduce((x,y)=>x+y,0));
    
    $('erpTableBody').innerHTML = sortedCats.length === 0 ? `<tr><td colspan="3" class="p-6 text-center text-gray-500">Nenhum cruzamento encontrado.</td></tr>` : 
    sortedCats.map(cat => Object.keys(catStateCounts[cat]).sort((a,b)=>catStateCounts[cat][b]-catStateCounts[cat][a]).map(st => 
        `<tr class="border-b hover:bg-indigo-50"><td class="p-2 border font-bold text-gray-700 bg-gray-50">${cat}</td><td class="p-2 border">${st}</td><td class="p-2 border text-center font-bold text-indigo-600">${catStateCounts[cat][st]}</td></tr>`
    ).join('')).join('');
}

window.copyERPTableData = function() {
    const rows = $('erpTableBody').querySelectorAll('tr');
    if(rows.length === 0 || rows[0].innerText.includes('Nenhum cruzamento')) return alert("Não há dados.");
    let tsv = "Categoria Ocorrência\tEstado/UF\tQuantidade\n";
    rows.forEach(tr => { const tds = tr.querySelectorAll('td'); if(tds.length === 3) tsv += `${tds[0].innerText}\t${tds[1].innerText}\t${tds[2].innerText}\n`; });
    navigator.clipboard.writeText(tsv).then(() => alert("Copiado!"));
}