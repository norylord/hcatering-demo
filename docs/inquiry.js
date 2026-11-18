import { ref, nextTick } from './vendor/vue.js'
import { api } from './shared.js'
import { eventOptions } from './event-options.js'

const emptyPlan = () => ({
  format: eventOptions.formats[0],
  guests: 30,
  date: '',
  venue: eventOptions.venues[0],
  services: [],
})

export function useInquiry() {
  const plan = ref(emptyPlan())
  const attached = ref(null)
  const contact = ref({ name: '', phone: '' })
  const sending = ref(false)
  const failure = ref('')
  const confirmation = ref('')
  let key = crypto.randomUUID()

  function attachPlan() {
    attached.value = { ...plan.value, services: [...plan.value.services] }
    confirmation.value = ''
    failure.value = ''
    nextTick(() => document.getElementById('inquiry-name').focus())
  }

  async function sendInquiry() {
    if (sending.value) return
    sending.value = true
    failure.value = ''
    confirmation.value = ''
    try {
      const result = await api('inquiries', 'POST', {
        key,
        ...contact.value,
        note: '',
        plan: attached.value,
      })
      confirmation.value =
        'Обращение №' +
        result.id +
        ' сохранено в этом браузере.'
      contact.value = { name: '', phone: '' }
      if (attached.value) plan.value = emptyPlan()
      attached.value = null
      key = crypto.randomUUID()
    } catch (error) {
      failure.value = error.message
    } finally {
      sending.value = false
    }
  }
  return {
    plan,
    attached,
    contact,
    sending,
    failure,
    confirmation,
    eventOptions,
    attachPlan,
    sendInquiry,
  }
}
