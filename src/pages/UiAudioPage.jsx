import { useState } from 'react'
import { supabase } from '../lib/supabase'
import SectionCard from '../components/SectionCard'

export default function UiAudioPage() {
  const [audioKey, setAudioKey] = useState('')
  const [lang, setLang] = useState('mina')
  const [audioFile, setAudioFile] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')

    if (!audioKey.trim()) {
      setMessage('La clé audio est obligatoire.')
      return
    }

    if (!audioFile) {
      setMessage('Choisis un fichier audio.')
      return
    }

    setLoading(true)

    try {
      const fileExt = audioFile.name.split('.').pop()
      const filePath = `${lang}/${audioKey}.${fileExt}`

      const { error: uploadError } = await supabase
        .storage
        .from('ui-audio')
        .upload(filePath, audioFile, { upsert: true })

      if (uploadError) throw uploadError

      const { error: upsertError } = await supabase
        .from('ui_audio_prompts')
        .upsert([{
          key: audioKey,
          lang,
          storage_bucket: 'ui-audio',
          storage_path: filePath,
          is_active: true
        }], {
          onConflict: 'key,lang'
        })

      if (upsertError) throw upsertError

      setMessage('Audio UI enregistré avec succès.')
      setAudioKey('')
      setAudioFile(null)
    } catch (err) {
      setMessage(`Erreur: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SectionCard title="Uploader un audio UI pour Miabe/Moulédi">
      <form onSubmit={handleSubmit} className="form-grid">
        <label>
          Clé audio
          <input
            value={audioKey}
            onChange={(e) => setAudioKey(e.target.value)}
            placeholder="home_intro"
          />
        </label>

        <label>
          Langue
          <select value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="mina">Mina</option>
            <option value="fr">Français</option>
          </select>
        </label>

        <label className="full">
          Fichier audio
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
          />
        </label>

        <div className="full actions">
          <button type="submit" disabled={loading}>
            {loading ? 'Upload...' : 'Enregistrer audio UI'}
          </button>
        </div>

        {message && <p className="message full">{message}</p>}
      </form>
    </SectionCard>
  )
}