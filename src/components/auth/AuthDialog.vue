<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { LockKeyhole, LogIn, LogOut, ShieldCheck, UserRound, X } from 'lucide-vue-next'

const authStore = useAuthStore()

const form = reactive({
  username: '',
  password: ''
})

const errorMessage = ref('')

const isOpen = computed(() => authStore.authDialogOpen || authStore.shouldBlockContent)
const canClose = computed(() => !authStore.shouldBlockContent)
const currentRoleLabel = computed(() => authStore.isAdmin ? '管理员' : '普通用户')

function close() {
  if (!canClose.value) return
  authStore.toggleAuthDialog(false)
  errorMessage.value = ''
}

function submit() {
  errorMessage.value = ''

  try {
    authStore.login(form.username, form.password)
    form.password = ''
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '登录失败'
  }
}

function logout() {
  authStore.logout()
  form.password = ''
  errorMessage.value = ''
}

watch(isOpen, (open) => {
  if (!open) {
    errorMessage.value = ''
  }
})
</script>

<template>
  <Transition
    enter-active-class="overlay-enter"
    enter-from-class="overlay-enter-from"
    enter-to-class="overlay-enter-to"
    leave-active-class="overlay-leave"
    leave-from-class="overlay-leave-from"
    leave-to-class="overlay-leave-to"
  >
    <div v-if="isOpen" class="auth-overlay" @click="close" />
  </Transition>

  <Transition
    enter-active-class="panel-enter"
    enter-from-class="panel-enter-from"
    enter-to-class="panel-enter-to"
    leave-active-class="panel-leave"
    leave-from-class="panel-leave-from"
    leave-to-class="panel-leave-to"
  >
    <div v-if="isOpen" class="auth-panel">
      <div class="auth-header">
        <div class="auth-title-wrap">
          <div class="auth-title-icon">
            <LockKeyhole class="panel-icon" />
          </div>
          <div>
            <h3 class="auth-title">账户认证</h3>
            <p class="auth-subtitle">
              {{ authStore.shouldBlockContent ? '登录后即可查看面板内容' : '登录后可使用管理员设置或进入普通用户视图' }}
            </p>
          </div>
        </div>
        <button v-if="canClose" class="close-btn" @click="close">
          <X class="panel-icon" />
        </button>
      </div>

      <template v-if="authStore.isLoggedIn">
        <div class="auth-state">
          <div class="auth-user-badge">
            <UserRound class="panel-icon" />
          </div>
          <div class="auth-user-meta">
            <strong>{{ authStore.currentUser?.username }}</strong>
            <span>{{ currentRoleLabel }}</span>
          </div>
        </div>

        <div class="auth-notice" :class="{ admin: authStore.isAdmin }">
          <ShieldCheck class="panel-icon" />
          <span>
            {{ authStore.isAdmin ? '当前账号拥有设置与用户管理权限。' : '当前账号可按管理员分配的分组权限浏览内容。' }}
          </span>
        </div>

        <div class="auth-actions">
          <button class="secondary-btn" @click="logout">
            <LogOut class="panel-icon" />
            退出登录
          </button>
          <button v-if="canClose" class="primary-btn" @click="close">完成</button>
        </div>
      </template>

      <template v-else>
        <div class="auth-form">
          <label class="field">
            <span class="field-label">用户名</span>
            <input v-model.trim="form.username" class="field-input" type="text" autocomplete="username" placeholder="请输入用户名" />
          </label>

          <label class="field">
            <span class="field-label">密码</span>
            <input v-model="form.password" class="field-input" type="password" autocomplete="current-password" placeholder="请输入密码" @keyup.enter="submit" />
          </label>

          <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
          <p class="auth-hint">首次启用时默认管理员账号为 `admin`，密码为 `admin123`。</p>

          <div class="auth-actions">
            <button class="primary-btn" @click="submit">
              <LogIn class="panel-icon" />
              登录
            </button>
            <button v-if="canClose" class="secondary-btn" @click="close">取消</button>
          </div>
        </div>
      </template>
    </div>
  </Transition>
</template>

<style scoped>
.auth-overlay {
  position: fixed;
  inset: 0;
  z-index: 160;
  background: rgb(3 8 18 / 0.58);
  backdrop-filter: blur(8px);
}

.auth-panel {
  position: fixed;
  inset: 50% auto auto 50%;
  transform: translate(-50%, -50%);
  z-index: 161;
  width: min(92vw, 30rem);
  padding: 1.15rem;
  border-radius: 1.4rem;
  border: 1px solid hsl(var(--glass-border));
  background: hsl(var(--glass-bg));
  backdrop-filter: blur(22px) saturate(140%);
  box-shadow: 0 24px 80px rgb(0 0 0 / 0.35);
}

.auth-header,
.auth-title-wrap,
.auth-state,
.auth-notice,
.auth-actions,
.close-btn,
.primary-btn,
.secondary-btn {
  display: flex;
  align-items: center;
}

.auth-header,
.auth-actions {
  justify-content: space-between;
}

.auth-header {
  gap: 1rem;
  margin-bottom: 1rem;
}

.auth-title-wrap,
.auth-state,
.auth-notice,
.auth-actions {
  gap: 0.75rem;
}

.auth-title {
  margin: 0;
  color: hsl(var(--text-primary));
  font-size: 1.05rem;
}

.auth-subtitle,
.auth-hint,
.field-label,
.auth-user-meta span {
  color: hsl(var(--text-secondary));
}

.auth-subtitle,
.auth-hint,
.error-text {
  margin: 0;
  font-size: 0.84rem;
}

.auth-title-icon,
.auth-user-badge {
  width: 2.6rem;
  height: 2.6rem;
  display: grid;
  place-items: center;
  border-radius: 0.9rem;
  background: hsl(var(--primary) / 0.16);
  color: hsl(var(--primary));
}

.close-btn,
.primary-btn,
.secondary-btn {
  justify-content: center;
  gap: 0.45rem;
  border-radius: 0.9rem;
  border: 1px solid hsl(var(--glass-border));
  background: transparent;
  color: hsl(var(--text-primary));
  cursor: pointer;
  padding: 0.72rem 0.95rem;
}

.close-btn {
  width: 2.4rem;
  height: 2.4rem;
  padding: 0;
  border-radius: 999px;
}

.primary-btn {
  background: hsl(var(--primary) / 0.16);
}

.secondary-btn {
  color: hsl(var(--text-secondary));
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.42rem;
}

.field-input {
  width: 100%;
  min-width: 0;
  border-radius: 0.9rem;
  border: 1px solid hsl(var(--glass-border));
  background: hsl(var(--glass-bg-hover));
  color: hsl(var(--text-primary));
  padding: 0.8rem 0.95rem;
  outline: none;
}

.field-input:focus {
  border-color: hsl(var(--neon-cyan) / 0.45);
}

.auth-user-meta {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.auth-notice {
  margin: 0.9rem 0 1rem;
  padding: 0.85rem 0.95rem;
  border-radius: 1rem;
  border: 1px solid hsl(var(--glass-border));
  color: hsl(var(--text-secondary));
  background: hsl(var(--glass-bg-hover));
}

.auth-notice.admin {
  color: hsl(var(--primary));
}

.error-text {
  color: hsl(var(--danger));
}

.panel-icon {
  width: 1rem;
  height: 1rem;
}

.overlay-enter,
.overlay-leave,
.panel-enter,
.panel-leave {
  transition: all 220ms ease;
}

.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}

.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: translate(-50%, calc(-50% + 12px)) scale(0.98);
}

@media (max-width: 640px) {
  .auth-panel {
    width: min(94vw, 30rem);
    padding: 1rem;
  }

  .auth-actions {
    flex-wrap: wrap;
  }

  .primary-btn,
  .secondary-btn {
    flex: 1 1 10rem;
  }
}
</style>
