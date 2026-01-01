// 全域變數
let currentUser = null;
let userProfile = null;
let currentChannelId = 'general';
let selectedAnimals = [];
let allUsers = {};
let channels = [];
let members = [];
let messages = [];

// 動物列表
const ALL_ANIMALS = [
    "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", 
    "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🦄", "🐙"
];

// 應用ID
const APP_ID = 'chatroom-89cc9';

// DOM 元素
const screens = {
    loading: document.getElementById('loading'),
    login: document.getElementById('login-screen'),
    chat: document.getElementById('chat-screen'),
    kicked: document.getElementById('kicked-screen')
};

const elements = {
    appName: document.getElementById('app-name'),
    animalGrid: document.querySelector('.animal-grid'),
    animalSlots: document.querySelectorAll('.animal-slot'),
    nextBtn: document.getElementById('next-btn'),
    loginForm: document.getElementById('login-form'),
    pinInput: document.getElementById('pin-input'),
    nameInput: document.getElementById('name-input'),
    loginError: document.getElementById('login-error'),
    loginBtn: document.getElementById('login-btn'),
    sidebarAppName: document.getElementById('sidebar-app-name'),
    userAvatar: document.getElementById('user-avatar'),
    userName: document.getElementById('user-name'),
    userId: document.getElementById('user-id'),
    channelsList: document.getElementById('channels-list'),
    membersList: document.getElementById('members-list'),
    currentChannelName: document.getElementById('current-channel-name'),
    currentChannelEmoji: document.getElementById('current-channel-emoji'),
    messagesContainer: document.getElementById('messages-container'),
    messageInput: document.getElementById('message-input'),
    messageForm: document.getElementById('message-form')
};

// 顯示畫面
function showScreen(screenName) {
    Object.values(screens).forEach(screen => {
        screen.style.display = 'none';
    });
    screens[screenName].style.display = 'flex';
}

// 初始化
async function initApp() {
    try {
        // 檢查Firebase是否可用
        if (!window.firebase || !window.firebase.auth) {
            throw new Error('Firebase 初始化失敗');
        }

        // 檢查是否已登入
        const cachedAnimalId = localStorage.getItem(`chat_app_animal_id_${APP_ID}`);
        
        if (cachedAnimalId) {
            // 嘗試匿名登入
            await firebase.signInAnonymously(firebase.auth);
        }

        // 監聽認證狀態
        firebase.onAuthStateChanged(firebase.auth, async (user) => {
            if (user) {
                currentUser = user;
                
                if (cachedAnimalId) {
                    // 載入使用者資料
                    await loadUserProfile(cachedAnimalId);
                } else {
                    // 顯示登入畫面
                    initLoginScreen();
                    showScreen('login');
                }
            } else {
                // 顯示登入畫面
                initLoginScreen();
                showScreen('login');
            }
        });

        // 監聽系統設定
        listenToSystemConfig();

    } catch (error) {
        console.error('初始化錯誤:', error);
        showScreen('login');
    }
}

// 初始化登入畫面
function initLoginScreen() {
    // 生成動物選項
    elements.animalGrid.innerHTML = '';
    ALL_ANIMALS.forEach(animal => {
        const button = document.createElement('button');
        button.className = 'animal-option';
        button.innerHTML = animal;
        button.onclick = () => selectAnimal(animal);
        elements.animalGrid.appendChild(button);
    });

    // 重置表單
    selectedAnimals = [];
    updateAnimalSlots();
    elements.pinInput.value = '';
    elements.nameInput.value = '';
    elements.loginError.style.display = 'none';

    // 顯示步驟1
    goToStep(1);
}

// 選擇動物
function selectAnimal(animal) {
    if (selectedAnimals.length < 3) {
        selectedAnimals.push(animal);
        updateAnimalSlots();
        updateAnimalOptions();
    }
}

// 移除動物
function removeAnimal(index) {
    if (index < selectedAnimals.length) {
        selectedAnimals.splice(index, 1);
        updateAnimalSlots();
        updateAnimalOptions();
    }
}

// 更新動物槽位
function updateAnimalSlots() {
    elements.animalSlots.forEach((slot, index) => {
        if (index < selectedAnimals.length) {
            slot.innerHTML = selectedAnimals[index];
            slot.classList.add('filled');
        } else {
            slot.innerHTML = '<span class="placeholder">?</span>';
            slot.classList.remove('filled');
        }
    });

    // 更新下一步按鈕狀態
    elements.nextBtn.disabled = selectedAnimals.length !== 3;
}

// 更新動物選項
function updateAnimalOptions() {
    document.querySelectorAll('.animal-option').forEach(option => {
        const animal = option.textContent;
        const count = selectedAnimals.filter(a => a === animal).length;
        
        if (count > 0) {
            option.classList.add('selected');
            
            // 顯示計數器
            let countBadge = option.querySelector('.animal-count');
            if (!countBadge) {
                countBadge = document.createElement('span');
                countBadge.className = 'animal-count';
                option.appendChild(countBadge);
            }
            countBadge.textContent = count;
        } else {
            option.classList.remove('selected');
            const countBadge = option.querySelector('.animal-count');
            if (countBadge) {
                countBadge.remove();
            }
        }
    });
}

// 切換步驟
function goToStep(step) {
    document.querySelectorAll('.login-step').forEach(el => {
        el.classList.remove('active');
    });
    
    document.getElementById(`step${step}`).classList.add('active');
    
    if (step === 2) {
        document.getElementById('selected-animals-preview').textContent = 
            selectedAnimals.join('');
    }
}

// 處理登入
async function handleLogin(event) {
    event.preventDefault();
    
    const pin = elements.pinInput.value.trim();
    const name = elements.nameInput.value.trim();
    
    // 驗證
    if (!pin || pin.length < 4) {
        showError('PIN 碼至少 4 位數');
        return;
    }
    
    try {
        elements.loginBtn.disabled = true;
        elements.loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 處理中...';
        
        const animalId = selectedAnimals.join('');
        
        // 檢查使用者是否存在
        const userDocRef = firebase.doc(firebase.db, 'users', animalId);
        const userDoc = await firebase.getDoc(userDocRef);
        
        if (userDoc.exists()) {
            // 驗證現有使用者
            const userData = userDoc.data();
            
            if (userData.pin !== pin) {
                throw new Error('PIN 碼錯誤！');
            }
            
            if (userData.kickedUntil && userData.kickedUntil > Date.now()) {
                const until = new Date(userData.kickedUntil);
                throw new Error(`您已被暫時踢出，請於 ${until.toLocaleString()} 後再試。`);
            }
            
            // 更新使用者資料
            await firebase.updateDoc(userDocRef, {
                uid: currentUser.uid,
                lastLoginAt: firebase.serverTimestamp(),
                lastSeenAt: firebase.serverTimestamp()
            });
            
        } else {
            // 建立新使用者
            if (!name.trim()) {
                throw new Error('初次使用此組合，請輸入您的暱稱！');
            }
            
            const isFirstUser = await checkIfFirstUser();
            
            const newProfile = {
                animalId: animalId,
                animals: [...selectedAnimals],
                pin: pin,
                name: name.trim(),
                avatarUrl: "",
                theme: 'dark',
                role: isFirstUser ? 'admin' : 'user',
                uid: currentUser.uid,
                createdAt: firebase.serverTimestamp(),
                lastSeenAt: firebase.serverTimestamp(),
                isBanned: false
            };
            
            await firebase.setDoc(userDocRef, newProfile);
            
            if (isFirstUser) {
                // 建立系統設定
                await firebase.setDoc(firebase.doc(firebase.db, 'system', 'config'), {
                    initialized: true,
                    adminId: animalId,
                    appName: "線上聊天室"
                });
                
                // 建立預設頻道
                await firebase.setDoc(firebase.doc(firebase.db, 'channels', 'general'), {
                    name: "💬 一般閒聊",
                    emoji: "💬",
                    createdAt: firebase.serverTimestamp(),
                    createdBy: animalId
                });
            }
        }
        
        // 儲存到本地儲存
        localStorage.setItem(`chat_app_animal_id_${APP_ID}`, animalId);
        
        // 載入使用者資料
        await loadUserProfile(animalId);
        
    } catch (error) {
        showError(error.message);
        elements.loginBtn.disabled = false;
        elements.loginBtn.innerHTML = '<span>進入聊天室</span><i class="fas fa-sign-in-alt"></i>';
    }
}

// 檢查是否為第一個使用者
async function checkIfFirstUser() {
    try {
        const configDoc = await firebase.getDoc(firebase.doc(firebase.db, 'system', 'config'));
        return !configDoc.exists();
    } catch (error) {
        console.error('檢查第一個使用者錯誤:', error);
        return false;
    }
}

// 顯示錯誤
function showError(message) {
    elements.loginError.textContent = message;
    elements.loginError.style.display = 'block';
    setTimeout(() => {
        elements.loginError.style.display = 'none';
    }, 5000);
}

// 載入使用者資料
async function loadUserProfile(animalId) {
    try {
        showScreen('loading');
        
        const userDocRef = firebase.doc(firebase.db, 'users', animalId);
        
        // 監聽使用者資料
        firebase.onSnapshot(userDocRef, async (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                
                if (data.uid !== currentUser.uid) {
                    // 使用者不匹配，登出
                    await handleLogout();
                    return;
                }
                
                if (data.kickedUntil && data.kickedUntil > Date.now()) {
                    // 使用者被踢出
                    showKickedScreen(data.kickedUntil);
                    return;
                }
                
                // 設定使用者資料
                userProfile = {
                    ...data,
                    id: doc.id
                };
                
                // 初始化聊天室
                await initChatRoom();
                showScreen('chat');
                
                // 開始心跳
                startHeartbeat();
                
            } else {
                // 文件不存在，登出
                await handleLogout();
            }
        }, (error) => {
            console.error('監聽使用者錯誤:', error);
            handleLogout();
        });
        
    } catch (error) {
        console.error('載入使用者錯誤:', error);
        handleLogout();
    }
}

// 顯示被踢出畫面
function showKickedScreen(until) {
    document.getElementById('kick-until').textContent = 
        `解鎖時間：${new Date(until).toLocaleString()}`;
    showScreen('kicked');
}

// 初始化聊天室
async function initChatRoom() {
    // 更新使用者介面
    updateUserUI();
    
    // 監聽頻道
    listenToChannels();
    
    // 監聽訊息
    listenToMessages();
    
    // 監聽所有使用者
    listenToAllUsers();
}

// 更新使用者UI
function updateUserUI() {
    if (!userProfile) return;
    
    elements.userName.textContent = userProfile.name;
    elements.userId.textContent = `ID: ${userProfile.animals?.join('') || ''}`;
    
    if (userProfile.avatarUrl) {
        elements.userAvatar.style.backgroundImage = `url(${userProfile.avatarUrl})`;
        elements.userAvatar.innerHTML = '';
    } else {
        elements.userAvatar.style.backgroundImage = 'none';
        elements.userAvatar.innerHTML = userProfile.animals?.[0] || '🐱';
    }
}

// 監聽頻道
function listenToChannels() {
    const channelsQuery = firebase.query(
        firebase.collection(firebase.db, 'channels'),
        firebase.orderBy('createdAt')
    );
    
    return firebase.onSnapshot(channelsQuery, (snapshot) => {
        channels = [];
        snapshot.forEach(doc => {
            channels.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        renderChannels();
        
        // 如果當前頻道不存在，切換到第一個頻道
        if (!channels.find(c => c.id === currentChannelId) && channels.length > 0) {
            currentChannelId = channels[0].id;
            updateCurrentChannel();
            listenToMessages();
        }
    });
}

// 渲染頻道列表
function renderChannels() {
    elements.channelsList.innerHTML = '';
    
    channels.forEach(channel => {
        const div = document.createElement('div');
        div.className = `channel-item ${channel.id === currentChannelId ? 'active' : ''}`;
        div.onclick = () => switchChannel(channel.id);
        
        div.innerHTML = `
            <span class="channel-emoji">${channel.emoji || '💬'}</span>
            <span>${channel.name}</span>
        `;
        
        elements.channelsList.appendChild(div);
    });
}

// 切換頻道
function switchChannel(channelId) {
    currentChannelId = channelId;
    updateCurrentChannel();
    listenToMessages();
    toggleMobileMenu(); // 在手機上關閉選單
}

// 更新當前頻道
function updateCurrentChannel() {
    const channel = channels.find(c => c.id === currentChannelId);
    if (channel) {
        elements.currentChannelName.textContent = channel.name;
        elements.currentChannelEmoji.textContent = channel.emoji || '💬';
    }
}

// 監聽訊息
function listenToMessages() {
    const messagesQuery = firebase.query(
        firebase.collection(firebase.db, 'messages'),
        firebase.orderBy('timestamp')
    );
    
    return firebase.onSnapshot(messagesQuery, (snapshot) => {
        messages = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(msg => msg.channelId === currentChannelId);
        
        renderMessages();
    });
}

// 渲染訊息
function renderMessages() {
    elements.messagesContainer.innerHTML = '';
    
    messages.forEach(msg => {
        const isOwn = msg.senderId === userProfile?.id;
        const senderUser = allUsers[msg.senderId];
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isOwn ? 'own' : ''}`;
        
        messageDiv.innerHTML = `
            <div class="message-avatar">
                ${senderUser?.avatarUrl ? 
                    `<img src="${senderUser.avatarUrl}" alt="${senderUser.name}" style="width:100%;height:100%;border-radius:50%;">` : 
                    (msg.senderAnimal || '👤')}
            </div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-sender">${senderUser?.name || msg.senderName || '未知使用者'}</span>
                    <span class="message-time">${formatTime(msg.timestamp)}</span>
                </div>
                <div class="message-text">${escapeHtml(msg.text)}</div>
            </div>
        `;
        
        elements.messagesContainer.appendChild(messageDiv);
    });
    
    // 滾動到底部
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

// 監聽所有使用者
function listenToAllUsers() {
    const usersQuery = firebase.query(firebase.collection(firebase.db, 'users'));
    
    return firebase.onSnapshot(usersQuery, (snapshot) => {
        allUsers = {};
        members = [];
        
        snapshot.forEach(doc => {
            const userData = { id: doc.id, ...doc.data() };
            allUsers[doc.id] = userData;
            members.push(userData);
        });
        
        // 排序：上線在前
        members.sort((a, b) => {
            const aOnline = isUserOnline(a);
            const bOnline = isUserOnline(b);
            if (aOnline && !bOnline) return -1;
            if (!aOnline && bOnline) return 1;
            return 0;
        });
        
        renderMembers();
    });
}

// 渲染成員列表
function renderMembers() {
    elements.membersList.innerHTML = '';
    
    members.forEach(member => {
        const isOnline = isUserOnline(member);
        const isOwn = member.id === userProfile?.id;
        
        const memberDiv = document.createElement('div');
        memberDiv.className = 'member-item';
        
        memberDiv.innerHTML = `
            <div class="avatar small">
                ${member.avatarUrl ? 
                    `<img src="${member.avatarUrl}" alt="${member.name}" style="width:100%;height:100%;border-radius:50%;">` : 
                    (member.animals?.[0] || '👤')}
            </div>
            <div class="member-info">
                <div class="member-name">
                    ${member.name}
                    ${member.role === 'admin' ? ' <span class="admin-badge">ADM</span>' : ''}
                </div>
                <div class="member-status ${isOnline ? 'online' : 'offline'}">
                    ${isOwn ? '● 您自己' : (isOnline ? '● 線上' : '離線')}
                </div>
            </div>
        `;
        
        elements.membersList.appendChild(memberDiv);
    });
}

// 檢查使用者是否在線
function isUserOnline(user) {
    if (!user.lastSeenAt) return false;
    const lastSeen = user.lastSeenAt.toDate ? 
        user.lastSeenAt.toDate().getTime() : 
        (user.lastSeenAt.seconds * 1000);
    return Date.now() - lastSeen < 3 * 60 * 1000; // 3分鐘內
}

// 監聽系統設定
function listenToSystemConfig() {
    const configDocRef = firebase.doc(firebase.db, 'system', 'config');
    
    return firebase.onSnapshot(configDocRef, (doc) => {
        if (doc.exists()) {
            const config = doc.data();
            if (config.appName) {
                elements.appName.textContent = config.appName;
                elements.sidebarAppName.textContent = config.appName;
            }
        }
    });
}

// 發送訊息
async function sendMessage(event) {
    event.preventDefault();
    
    const text = elements.messageInput.value.trim();
    if (!text || !userProfile) return;
    
    try {
        await firebase.addDoc(firebase.collection(firebase.db, 'messages'), {
            text: text,
            channelId: currentChannelId,
            senderId: userProfile.id,
            senderName: userProfile.name,
            senderAvatarUrl: userProfile.avatarUrl || "",
            senderAnimal: userProfile.animals?.[0] || '👤',
            senderUid: currentUser.uid,
            timestamp: Date.now(),
            type: 'text'
        });
        
        elements.messageInput.value = '';
        
        // 更新最後活動時間
        await updateLastSeen();
        
    } catch (error) {
        console.error('發送訊息錯誤:', error);
        showAlert('發送訊息失敗', 'error');
    }
}

// 更新最後活動時間
async function updateLastSeen() {
    if (!userProfile) return;
    
    try {
        await firebase.updateDoc(
            firebase.doc(firebase.db, 'users', userProfile.id),
            { lastSeenAt: firebase.serverTimestamp() }
        );
    } catch (error) {
        console.error('更新活動時間錯誤:', error);
    }
}

// 開始心跳
function startHeartbeat() {
    updateLastSeen();
    setInterval(updateLastSeen, 60 * 1000); // 每分鐘一次
}

// 切換側邊欄檢視
function toggleSidebarView() {
    const channelsView = document.getElementById('channels-view');
    const membersView = document.getElementById('members-view');
    const icon = document.getElementById('sidebar-toggle-icon');
    
    if (channelsView.style.display !== 'none') {
        channelsView.style.display = 'none';
        membersView.style.display = 'block';
        icon.className = 'fas fa-hashtag';
    } else {
        channelsView.style.display = 'block';
        membersView.style.display = 'none';
        icon.className = 'fas fa-users';
    }
}

// 切換行動選單
function toggleMobileMenu() {
    document.querySelector('.sidebar').classList.toggle('open');
}

// 顯示管理面板
function showAdminPanel() {
    document.getElementById('admin-panel').style.display = 'flex';
    switchAdminTab('settings');
    loadAdminData();
}

// 隱藏管理面板
function hideAdminPanel() {
    document.getElementById('admin-panel').style.display = 'none';
}

// 切換管理標籤
function switchAdminTab(tabName) {
    // 移除所有標籤的active類別
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // 啟用選中的標籤
    document.querySelector(`.admin-tab[onclick*="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // 載入對應資料
    loadAdminTabData(tabName);
}

// 載入管理資料
function loadAdminData() {
    loadAdminTabData('settings');
}

// 載入管理標籤資料
function loadAdminTabData(tabName) {
    switch(tabName) {
        case 'settings':
            loadSettingsTab();
            break;
        case 'system':
            loadSystemTab();
            break;
        case 'channels':
            loadChannelsTab();
            break;
        case 'users':
            loadUsersTab();
            break;
    }
}

// 載入設定標籤
function loadSettingsTab() {
    const tabContent = document.getElementById('settings-tab');
    if (!userProfile) return;
    
    tabContent.innerHTML = `
        <div class="card">
            <h4>佈景主題</h4>
            <div class="theme-toggle">
                <button onclick="switchTheme('dark')" class="${userProfile.theme === 'dark' ? 'active' : ''}">
                    <i class="fas fa-moon"></i> 暗色
                </button>
                <button onclick="switchTheme('light')" class="${userProfile.theme === 'light' ? 'active' : ''}">
                    <i class="fas fa-sun"></i> 亮色
                </button>
            </div>
        </div>
        
        <div class="card">
            <h4>修改 PIN 碼</h4>
            <div class="form-group">
                <input type="text" id="new-pin" placeholder="輸入新 PIN 碼 (4-8位數字)" 
                       oninput="this.value = this.value.replace(/\\D/g,'').slice(0,8)">
            </div>
        </div>
        
        <div class="card">
            <h4>頭像設定</h4>
            <div class="form-group">
                <input type="url" id="avatar-url" 
                       placeholder="輸入頭像圖片網址" 
                       value="${userProfile.avatarUrl || ''}">
            </div>
        </div>
        
        <button onclick="updateProfile()" class="btn-primary">
            <i class="fas fa-save"></i> 儲存變更
        </button>
    `;
}

// 切換主題
function switchTheme(theme) {
    if (!userProfile) return;
    
    userProfile.theme = theme;
    document.body.classList.toggle('light-mode', theme === 'light');
    updateProfile();
}

// 更新個人資料
async function updateProfile() {
    if (!userProfile) return;
    
    try {
        const newPin = document.getElementById('new-pin')?.value;
        const avatarUrl = document.getElementById('avatar-url')?.value;
        
        const updates = {
            avatarUrl: avatarUrl || userProfile.avatarUrl,
            theme: userProfile.theme || 'dark'
        };
        
        if (newPin && newPin.length >= 4) {
            updates.pin = newPin;
        }
        
        await firebase.updateDoc(
            firebase.doc(firebase.db, 'users', userProfile.id),
            updates
        );
        
        showAlert('更新成功', 'success');
        updateUserUI();
        
    } catch (error) {
        console.error('更新資料錯誤:', error);
        showAlert('更新失敗', 'error');
    }
}

// 顯示確認對話框
function showConfirm(title, message, action) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-modal').style.display = 'flex';
    
    window.confirmAction = action;
}

function confirmCancel() {
    document.getElementById('confirm-modal').style.display = 'none';
    window.confirmAction = null;
}

function confirmAction() {
    if (window.confirmAction) {
        window.confirmAction();
    }
    confirmCancel();
}

// 顯示通知
function showAlert(message, type = 'info') {
    const icon = document.getElementById('alert-icon');
    const alertMessage = document.getElementById('alert-message');
    
    switch(type) {
        case 'success':
            icon.className = 'fas fa-check-circle text-success';
            break;
        case 'error':
            icon.className = 'fas fa-exclamation-circle text-danger';
            break;
        default:
            icon.className = 'fas fa-info-circle text-info';
    }
    
    alertMessage.textContent = message;
    document.getElementById('alert-modal').style.display = 'flex';
}

function hideAlert() {
    document.getElementById('alert-modal').style.display = 'none';
}

// 登出
async function handleLogout() {
    try {
        await firebase.signOut(firebase.auth);
        localStorage.removeItem(`chat_app_animal_id_${APP_ID}`);
        currentUser = null;
        userProfile = null;
        initLoginScreen();
        showScreen('login');
    } catch (error) {
        console.error('登出錯誤:', error);
    }
}

// 處理被踢出後的登出
async function handleKickedLogout() {
    localStorage.removeItem(`chat_app_animal_id_${APP_ID}`);
    await firebase.signOut(firebase.auth);
    initLoginScreen();
    showScreen('login');
}

// 工具函數
function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 啟動應用
document.addEventListener('DOMContentLoaded', initApp);

// 監聽鍵盤快捷鍵
document.addEventListener('keydown', (e) => {
    // Ctrl+Enter 發送訊息
    if (e.ctrlKey && e.key === 'Enter' && elements.messageInput === document.activeElement) {
        sendMessage(new Event('submit'));
    }
    
    // Esc 關閉管理面板
    if (e.key === 'Escape') {
        hideAdminPanel();
        confirmCancel();
        hideAlert();
    }
});
