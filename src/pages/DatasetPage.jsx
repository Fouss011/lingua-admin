import { useState } from 'react'
import { supabase } from '../lib/supabase'
import SectionCard from '../components/SectionCard'

export default function DatasetPage() {
  const [entryType, setEntryType] = useState('word')
  const [sourceLang, setSourceLang] = useState('mina')
  const [targetLang, setTargetLang] = useState('fr')
  const [domain, setDomain] = useState('sante')
  const [intent, setIntent] = useState('')
  const [wordText, setWordText] = useState('')
  const [phraseText, setPhraseText] = useState('')
  const [translationFr, setTranslationFr] = useState('')
  const [exampleText, setExampleText] = useState('')
  const [contributorName, setContributorName] = useState('')
  const [audioFile, setAudioFile] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')

    if (!contributorName.trim()) {
      setMessage('Le nom du contributeur est obligatoire.')
      return
    }

    if (entryType === 'word' && !wordText.trim()) {
      setMessage('Le mot est obligatoire.')
      return
    }

    if (entryType === 'phrase' && !phraseText.trim()) {
      setMessage('La phrase est obligatoire.')
      return
    }

    if (!translationFr.trim()) {
      setMessage('La traduction française est obligatoire.')
      return
    }

    setLoading(true)

    try {
      const payload = {
        entry_type: entryType,
        source_lang: sourceLang,
        target_lang: targetLang,
        domain,
        intent: intent || null,
        word_text: entryType === 'word' ? wordText : null,
        phrase_text: entryType === 'phrase' ? phraseText : null,
        translation_fr: translationFr,
        example_text: exampleText || null,
        contributor_name: contributorName,
        status: 'submitted'
      }

      const { data: inserted, error: insertError } = await supabase
        .from('dataset_entries')
        .insert([payload])
        .select()
        .single()

      if (insertError) throw insertError

      if (audioFile) {
        const fileExt = audioFile.name.split('.').pop()
        const baseName = inserted.id
        const filePath = `${sourceLang}/${entryType}/${baseName}.${fileExt}`

        const { error: uploadError } = await supabase
          .storage
          .from('dataset-audio')
          .upload(filePath, audioFile, { upsert: true })

        if (uploadError) throw uploadError

        const { error: audioRowError } = await supabase
          .from('dataset_entry_audios')
          .insert([{
            entry_id: inserted.id,
            audio_kind: entryType,
            storage_bucket: 'dataset-audio',
            storage_path: filePath,
            speaker_name: contributorName
          }])

        if (audioRowError) throw audioRowError
      }

      setMessage('Entrée enregistrée avec succès.')
      setWordText('')
      setPhraseText('')
      setTranslationFr('')
      setExampleText('')
      setContributorName('')
      setIntent('')
      setAudioFile(null)
    } catch (err) {
      setMessage(`Erreur: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SectionCard title="Créer une entrée dataset">
      <form onSubmit={handleSubmit} className="form-grid">
        <label>
          Type d’entrée
          <select value={entryType} onChange={(e) => setEntryType(e.target.value)}>
            <option value="word">Mot</option>
            <option value="phrase">Phrase</option>
          </select>
        </label>

        <label>
          Langue source
          <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}>
            <option value="mina">Mina</option>
            <option value="bambara">Bambara</option>
          </select>
        </label>

        <label>
          Langue cible
          <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
            <option value="fr">Français</option>
          </select>
        </label>

        <label>
          Domaine
          <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="sante" />
        </label>

        <label>
          Intent
          <input value={intent} onChange={(e) => setIntent(e.target.value)} placeholder="facultatif" />
        </label>

        {entryType === 'word' && (
          <label className="full">
            Mot
            <input value={wordText} onChange={(e) => setWordText(e.target.value)} placeholder="mot en mina" />
          </label>
        )}

        {entryType === 'phrase' && (
          <label className="full">
            Phrase
            <textarea
              value={phraseText}
              onChange={(e) => setPhraseText(e.target.value)}
              placeholder="phrase en mina"
              rows="3"
            />
          </label>
        )}

        <label className="full">
          Traduction FR
          <input
            value={translationFr}
            onChange={(e) => setTranslationFr(e.target.value)}
            placeholder="traduction française"
          />
        </label>

        <label className="full">
          Exemple
          <textarea
            value={exampleText}
            onChange={(e) => setExampleText(e.target.value)}
            placeholder="exemple d’usage"
            rows="3"
          />
        </label>

        <label>
          Contributeur
          <input
            value={contributorName}
            onChange={(e) => setContributorName(e.target.value)}
            placeholder="Nom du contributeur"
          />
        </label>

        <label>
          Audio
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
          />
        </label>

        <div className="full actions">
          <button type="submit" disabled={loading}>
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>

        {message && <p className="message full">{message}</p>}
      </form>
    </SectionCard>
  )
}