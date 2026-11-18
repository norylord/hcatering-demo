import {
  createApp,
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  onUnmounted,
} from './vendor/vue.js'
import { api, money } from './shared.js'
import { useInquiry } from './inquiry.js'
createApp({
  setup() {
    const categories = ref([]),
      dishes = ref([]),
      favoritesDialog = ref(null),
      loading = ref(true),
      error = ref(''),
      cartError = ref('')
    const cart = ref({}),
      dialog = ref(),
      receipt = ref(null),
      busy = ref(false),
      form = ref({ name: '', phone: '', note: '' })
    const favoriteKey = new URL('./favorites', import.meta.url).pathname
    function readFavorites() {
      try {
        const ids = JSON.parse(localStorage.getItem(favoriteKey) || '[]')
        if (Array.isArray(ids))
          return new Set(ids.filter((id) => Number.isSafeInteger(id) && id > 0))
      } catch {}
      return new Set()
    }
    const favorites = ref(readFavorites())
    const favoriteDishes = computed(() =>
      dishes.value.filter((d) => favorites.value.has(d.id)),
    )
    function toggleFavorite(id) {
      if (favorites.value.has(id)) favorites.value.delete(id)
      else favorites.value.add(id)
      try {
        localStorage.setItem(favoriteKey, JSON.stringify([...favorites.value]))
      } catch {}
    }
    function syncFavorites(event) {
      if (event.key === favoriteKey || event.key === null)
        favorites.value = readFavorites()
    }
    onMounted(() => window.addEventListener('storage', syncFavorites))
    onUnmounted(() => window.removeEventListener('storage', syncFavorites))

    let key = crypto.randomUUID()
    try {
      const stored = JSON.parse(
        localStorage.getItem(new URL('./cart', import.meta.url).pathname) ||
          '{}',
      )
      for (const [id, qty] of Object.entries(stored))
        if (/^\d+$/.test(id) && Number.isInteger(qty) && qty > 0 && qty <= 99)
          cart.value[id] = qty
    } catch {}
    watch(
      cart,
      () => {
        key = crypto.randomUUID()
        try {
          localStorage.setItem(
            new URL('./cart', import.meta.url).pathname,
            JSON.stringify(cart.value),
          )
        } catch {}
      },
      { deep: true },
    )
    async function load() {
      error.value = ''
      loading.value = true
      try {
        const data = await api('menu')
        dishes.value = data.dishes
        categories.value = data.categories.filter((c) =>
          data.dishes.some((d) => d.category === c.id),
        )
        for (const id of Object.keys(cart.value))
          if (!data.dishes.some((d) => String(d.id) === id))
            delete cart.value[id]
      } catch (e) {
        error.value = e.message
      } finally {
        loading.value = false
      }
    }
    onMounted(load)
    const sections = computed(() =>
      categories.value.map((category) => {
        const items = dishes.value.filter(
          (dish) => dish.category === category.id,
        )
        return {
          ...category,
          items,
          cover: items.find((dish) => dish.image)?.image,
        }
      }),
    )
    const lines = computed(() =>
      dishes.value
        .filter((d) => cart.value[d.id])
        .map((d) => ({ ...d, qty: cart.value[d.id] })),
    )
    const count = computed(() => lines.value.reduce((n, d) => n + d.qty, 0)),
      total = computed(() =>
        lines.value.reduce((n, d) => n + d.price * d.qty, 0),
      )
    function change(id, by) {
      if (busy.value) return
      const n = Math.min(99, (cart.value[id] || 0) + by)
      if (n > 0) cart.value[id] = n
      else delete cart.value[id]
    }
    const detailDialog = ref(null)
    const selectedDish = ref(null)
    async function openDish(dish, trigger) {
      selectedDish.value = dish
      await nextTick()
      trigger?.focus({ preventScroll: true })
      detailDialog.value.showModal()
      detailDialog.value.scrollTop = 0
    }
    function onCardClick(event, dish) {
      if (event.target.closest('button')) return
      openDish(dish, event.currentTarget.querySelector('.dish-link'))
    }
    function openCart() {
      cartError.value = ''
      dialog.value.showModal()
    }
    function backdrop(e) {
      if (e.target === dialog.value) dialog.value.close()
    }
    async function submit() {
      if (busy.value) return
      busy.value = true
      cartError.value = ''
      try {
        const result = await api('orders', 'POST', {
          ...form.value,
          key,
          items: lines.value.map(({ id, price, qty }) => ({ id, price, qty })),
        })
        receipt.value = result.id
        cart.value = {}
        form.value = {
          name: '',
          phone: '',
          note: '',
        }
      } catch (e) {
        cartError.value = e.message
        if (e.status === 409) await load()
      } finally {
        busy.value = false
      }
    }
    return {
      ...useInquiry(),
      categories,
      dishes,
      favoritesDialog,
      loading,
      error,
      cartError,
      cart,
      dialog,
      receipt,
      busy,
      form,
      favorites,
      favoriteDishes,
      toggleFavorite,
      sections,
      lines,
      count,
      total,
      change,
      openCart,
      openDish,
      onCardClick,
      selectedDish,
      detailDialog,
      backdrop,
      submit,
      load,
      money,
    }
  },
}).mount('#app')
