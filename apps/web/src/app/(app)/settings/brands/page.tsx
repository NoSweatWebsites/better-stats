'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, Plus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Brand = { id: string; name: string; isOwnBrand: boolean | null; createdAt: string }

export default function BrandsSettingsPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [newName, setNewName] = useState('')
  const [isOwnBrand, setIsOwnBrand] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/brands').then((r) => r.json()).then((data) => { setBrands(data); setLoading(false) })
  }, [])

  async function addBrand() {
    if (!newName.trim()) return
    setSaving(true)
    const res = await fetch('/api/brands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), isOwnBrand }),
    })
    const row = await res.json()
    setBrands((b) => [...b, row])
    setNewName('')
    setIsOwnBrand(false)
    setSaving(false)
  }

  async function deleteBrand(id: string) {
    await fetch(`/api/brands/${id}`, { method: 'DELETE' })
    setBrands((b) => b.filter((x) => x.id !== id))
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-semibold text-(--foreground) mb-1">Tracked Brands</h1>
      <p className="text-sm text-(--muted-2) mb-6">Add your brand and competitors to track mentions across AI responses.</p>

      <div className="flex gap-2 mb-6 items-center">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Brand name"
          onKeyDown={(e) => e.key === 'Enter' && addBrand()}
        />
        <label className="flex items-center gap-1.5 text-sm text-(--muted) whitespace-nowrap cursor-pointer">
          <input
            type="checkbox"
            checked={isOwnBrand}
            onChange={(e) => setIsOwnBrand(e.target.checked)}
            className="rounded"
          />
          My brand
        </label>
        <Button onClick={addBrand} disabled={!newName.trim() || saving} size="sm">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Add
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-20">
          <Loader2 className="animate-spin text-(--border)" size={20} />
        </div>
      ) : brands.length === 0 ? (
        <p className="text-sm text-(--muted-2)">No brands yet.</p>
      ) : (
        <div className="space-y-2">
          {brands.map((b) => (
            <div key={b.id} className="flex items-center justify-between bg-(--surface) border border-(--border) rounded-lg px-4 py-3">
              <span className="text-sm text-(--muted) flex items-center gap-2">
                {b.name}
                {b.isOwnBrand && (
                  <span className="text-[10px] bg-[color-mix(in_srgb,var(--primary)_14%,white)] text-(--foreground) px-1.5 py-0.5 rounded-full font-medium">You</span>
                )}
              </span>
              <button onClick={() => deleteBrand(b.id)} className="text-gray-300 hover:text-red-400 transition-colors ml-4">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
