export const money = n => new Intl.NumberFormat('ru-RU').format(n) + ' ₽'
const storageKey = 'hcatering-demo-v1:' + new URL('.', import.meta.url).pathname
let initialCatalog

async function catalog() {
  if (!initialCatalog) {
    const response = await fetch(new URL('./menu.json', import.meta.url))
    if (!response.ok) throw new Error('Не удалось загрузить меню.')
    initialCatalog = await response.json()
  }
  return structuredClone(initialCatalog)
}

function reject(message, status = 400) {
  throw Object.assign(new Error(message), { status })
}

function recordRequest(state, path, data) {
  const list = state[path]
  const duplicate = list.find(row => row.key === data.key)
  if (duplicate) return { id: duplicate.id }
  const name = data.name?.trim()
  const phone = data.phone?.trim()
  if (!name || name.length > 100) reject('Укажите имя.')
  if (!phone || phone.length > 32 || !/^[+\d\s()-]+$/.test(phone) || !/^\d{7,15}$/.test(phone.replace(/\D/g, ''))) {
    reject('Проверьте номер телефона.')
  }
  const record = {
    id: ++state.sequence[path], key: data.key, created: new Date().toISOString(),
    name, phone, note: data.note || '',
  }
  if (path === 'orders') {
    if (!data.items?.length) reject('Корзина пуста.')
    record.items = data.items.map(line => {
      const dish = state.dishes.find(d => d.id === line.id && d.visible)
      if (!dish || line.price !== dish.price) reject('Меню изменилось. Проверьте корзину.', 409)
      if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > 99) reject('Проверьте количество.')
      return { id: dish.id, name: dish.name, price: dish.price, portion: dish.portion, qty: line.qty }
    })
    record.total = record.items.reduce((sum, line) => sum + line.price * line.qty, 0)
  } else {
    record.plan = data.plan || null
  }
  list.unshift(record)
  return { id: record.id }
}

function edit(state, path, method, data) {
  const [table, rawId] = path.split('/')
  if (!['categories','dishes'].includes(table)) reject('Действие недоступно.')
  const list = state[table]
  const id = Number(rawId)
  const index = list.findIndex(row => row.id === id)
  if (rawId && index < 0) reject('Запись уже удалена.', 404)
  if (method === 'DELETE') {
    if (table === 'categories' && state.dishes.some(d => d.category === id)) reject('Сначала перенесите блюда в другую категорию.')
    list.splice(index, 1)
  } else {
    const name = data.name?.trim()
    if (!name) reject('Укажите название.')
    if (table === 'categories' && list.some(row => row.id !== id && row.name === name)) reject('Такая категория уже есть.')
    if (table === 'dishes' && !state.categories.some(c => c.id === data.category)) reject('Выберите категорию.')
    const row = {...data, name, id: rawId ? id : ++state.sequence[table]}
    if (rawId) list[index] = row
    else list.push(row)
  }
  return {}
}

export async function api(path, method = 'GET', data) {
  if (path === 'session') return {signed: true}
  const seed = await catalog()
  function run() {
    const raw = localStorage.getItem(storageKey)
    const state = raw ? JSON.parse(raw) : {
      ...seed, orders: [], inquiries: [],
      sequence: {
        dishes: Math.max(0, ...seed.dishes.map(row => row.id)),
        categories: Math.max(0, ...seed.categories.map(row => row.id)),
        orders: 0, inquiries: 0,
      },
    }
    if (path === 'admin') return state
    if (path === 'menu') return {categories: state.categories, dishes: state.dishes.filter(row => row.visible)}
    const result = ['orders', 'inquiries'].includes(path)
      ? recordRequest(state, path, data)
      : edit(state, path, method, data)
    try {
      localStorage.setItem(storageKey, JSON.stringify(state))
    } catch {
      reject('Не удалось сохранить изменения. Проверьте доступ к хранилищу браузера или уменьшите размер фотографии.')
    }
    return result
  }
  if (method !== 'GET' && navigator.locks) return navigator.locks.request(storageKey, run)
  return run()
}
