import { createApp, ref, computed, onMounted } from './vendor/vue.js'
import { api, money } from './shared.js'
createApp({
  setup() {
    const loading = ref(true),
      signed = ref(false),
      busy = ref(false),
      password = ref(''),
      notice = ref(''),
      error = ref(''),
      modalError = ref('')
    const dishes = ref([]),
      categories = ref([]),
      orders = ref([]),
      inquiries = ref([]),
      tab = ref('Блюда'),
      query = ref('')
    const editor = ref(),
      file = ref(),
      draft = ref({}),
      kind = ref('dishes')
    function handle(e) {
      if (e.status === 401) {
        signed.value = false
        editor.value?.close()
      }
      error.value = e.message
    }
    async function refresh() {
      error.value = ''
      try {
        const data = await api('admin')
        dishes.value = data.dishes
        categories.value = data.categories
        inquiries.value = data.inquiries || []
        orders.value = data.orders
      } catch (e) {
        handle(e)
      }
    }
    onMounted(async () => {
      try {
        signed.value = (await api('session')).signed
        if (signed.value) await refresh()
      } catch (e) {
        handle(e)
      } finally {
        loading.value = false
      }
    })
    async function login() {
      busy.value = true
      try {
        await api('login', 'POST', { password: password.value })
        password.value = ''
        signed.value = true
        await refresh()
      } catch (e) {
        handle(e)
      } finally {
        busy.value = false
      }
    }
    async function logout() {
      try {
        await api('logout', 'POST', {})
        signed.value = false
        inquiries.value = []
        orders.value = []
        notice.value = ''
      } catch (e) {
        handle(e)
      }
    }
    function open(kindName, values) {
      kind.value = kindName
      draft.value = { ...values }
      modalError.value = ''
      notice.value = ''
      if (file.value) file.value.value = ''
      editor.value.showModal()
    }
    function editCategory(c = { name: '' }) {
      open('categories', c)
    }
    function editDish(
      d = {
        name: '',
        description: '',
        category: categories.value[0]?.id || '',
        price: null,
        portion: '',
        image: '',
        visible: true,
      },
    ) {
      open('dishes', { ...d, visible: !!d.visible })
    }
    async function upload(event) {
      const image = event.target.files[0]
      if (!image) return
      modalError.value = ''
      if (
        image.size > 3 * 1024 * 1024 ||
        !['image/jpeg', 'image/png', 'image/webp'].includes(image.type)
      ) {
        modalError.value = 'Выберите JPG, PNG или WebP до 3 МБ.'
        event.target.value = ''
        return
      }
      busy.value = true
      try {
        draft.value.image = await new Promise((ok, no) => {
          const reader = new FileReader()
          reader.onload = () => ok(reader.result)
          reader.onerror = no
          reader.readAsDataURL(image)
        })
      } catch {
        modalError.value = 'Не удалось прочитать фото.'
      } finally {
        busy.value = false
      }
    }
    async function persist(method) {
      if (busy.value) return
      busy.value = true
      modalError.value = ''
      try {
        await api(
          kind.value + (draft.value.id ? '/' + draft.value.id : ''),
          method,
          method === 'DELETE' ? {} : draft.value,
        )
        editor.value.close()
        notice.value = method === 'DELETE' ? 'Удалено.' : 'Изменения сохранены.'
        await refresh()
      } catch (e) {
        if (e.status === 401) handle(e)
        else modalError.value = e.message
      } finally {
        busy.value = false
      }
    }
    const save = () => persist(draft.value.id ? 'PUT' : 'POST')
    function remove() {
      if (confirm('Удалить «' + draft.value.name + '»?')) persist('DELETE')
    }
    return {
      loading,
      signed,
      busy,
      password,
      notice,
      error,
      modalError,
      dishes,
      categories,
      orders,
      tab,
      inquiries,
      tabs: ['Блюда', 'Категории', 'Заявки', 'Обращения'],
      query,
      editor,
      file,
      draft,
      kind,
      filtered: computed(() =>
        dishes.value.filter((d) =>
          d.name.toLowerCase().includes(query.value.toLowerCase()),
        ),
      ),
      catName: (id) => categories.value.find((c) => c.id === id)?.name,
      money,
      refresh,
      login,
      logout,
      editDish,
      editCategory,
      upload,
      save,
      remove,
    }
  },
}).mount('#admin')
