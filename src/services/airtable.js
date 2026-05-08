import { AIRTABLE_BASE_ID, AIRTABLE_TOKEN, AIRTABLE_TABLE } from '../config'

const cache = new Map()

export async function getRecordId(url) {
  if (cache.has(url)) return cache.get(url)
  const formula = `{url}='${url}'`
  const ep = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}?filterByFormula=${encodeURIComponent(formula)}&fields[]=url`
  const res = await fetch(ep, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } })
  if (!res.ok) throw new Error(`Airtable HTTP ${res.status}`)
  const data = await res.json()
  if (!data.records?.length) throw new Error(`No record for "${url}"`)
  const rid = data.records[0].id
  cache.set(url, rid)
  return rid
}

export async function patchContactStatus(url, status) {
  const rid = await getRecordId(url)
  const res = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}/${rid}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { contact_status: status } }),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `PATCH HTTP ${res.status}`)
  }
  return res.json()
}

export async function fetchAllRecords() {
  let records = [], offset = null
  do {
    const u = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}?pageSize=100${offset ? '&offset=' + offset : ''}`
    const res = await fetch(u, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } })
    if (!res.ok) throw new Error(`Airtable HTTP ${res.status}`)
    const data = await res.json()
    records = [...records, ...data.records]
    offset = data.offset
  } while (offset)
  return records
}
