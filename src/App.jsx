import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './lib/supabase'

const UI_AUDIO_KEYS = [
  { value: 'home_intro', label: 'Accueil - Intro' },
  { value: 'search_intro', label: 'Recherche - Intro' },
  { value: 'no_results', label: 'Aucun résultat' },
  { value: 'location_permission_denied', label: 'Permission localisation refusée' },
  { value: 'tap_mic_hint', label: 'Conseil appuyer micro' },
  { value: 'loading_prompt', label: 'Chargement' },
]

export default function App() {
  const [tab, setTab] = useState('dataset')

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Lingua Admin</h1>
        <p style={styles.subtitle}>
          Dataset linguistique + audios UI Moulédi, séparés proprement.
        </p>

        <div style={styles.tabs}>
          <button
            type="button"
            onClick={() => setTab('dataset')}
            style={{
              ...styles.tabButton,
              ...(tab === 'dataset' ? styles.tabButtonActive : {}),
            }}
          >
            Dataset
          </button>

          <button
            type="button"
            onClick={() => setTab('ui')}
            style={{
              ...styles.tabButton,
              ...(tab === 'ui' ? styles.tabButtonActive : {}),
            }}
          >
            Audios UI Moulédi
          </button>
        </div>

        {tab === 'dataset' ? <DatasetForm /> : <UiAudioForm />}
      </div>
    </div>
  )
}

function DatasetForm() {
  const [entryType, setEntryType] = useState('word')
  const [sourceLanguage, setSourceLanguage] = useState('mina')
  const [targetLanguage, setTargetLanguage] = useState('fr')
  const [domain, setDomain] = useState('sante')
  const [pos, setPos] = useState('nom')
  const [sourceText, setSourceText] = useState('')
  const [translationText, setTranslationText] = useState('')
  const [exampleSource, setExampleSource] = useState('')
  const [exampleTarget, setExampleTarget] = useState('')
  const [intent, setIntent] = useState('')
  const [contributorName, setContributorName] = useState('')
  const [uploadedFile, setUploadedFile] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const recorder = useAudioRecorder('dataset', { mode: 'dataset' })

  const finalAudioFile = useMemo(() => {
    return recorder.recordedFile || uploadedFile || null
  }, [recorder.recordedFile, uploadedFile])

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')

    if (!sourceText.trim()) {
      setMessage("Le mot ou la phrase source est obligatoire.")
      return
    }

    if (!translationText.trim()) {
      setMessage("La traduction est obligatoire.")
      return
    }

    if (!contributorName.trim()) {
      setMessage("Le nom du contributeur est obligatoire.")
      return
    }

    setLoading(true)

    try {
      const payload = {
        entry_type: entryType,
        source_language: sourceLanguage,
        target_language: targetLanguage,
        domain,
        pos: entryType === 'phrase' ? 'expr' : pos,
        source_text: sourceText.trim(),
        translation_text: translationText.trim(),
        example_source: exampleSource.trim() || null,
        example_target: exampleTarget.trim() || null,
        intent: intent.trim() || null,
        contributor_name: contributorName.trim(),
        status: 'submitted',
      }

      const { data: entry, error: insertError } = await supabase
        .from('dataset_entries_admin')
        .insert([payload])
        .select()
        .single()

      if (insertError) throw insertError

      if (finalAudioFile) {
        const ext = getExtensionFromFile(finalAudioFile)
        const contentType = finalAudioFile.type || guessContentTypeFromExt(ext)
        const path = `${sourceLanguage}/admin/${entry.id}-${Date.now()}.${ext}`

        const { error: uploadError } = await supabase
          .storage
          .from('lingua-audio')
          .upload(path, finalAudioFile, {
            upsert: true,
            contentType,
          })

        if (uploadError) throw uploadError

        const { error: audioInsertError } = await supabase
          .from('dataset_entry_audios_admin')
          .insert([{
            entry_id: entry.id,
            storage_bucket: 'lingua-audio',
            storage_path: path,
            audio_role: 'main',
          }])

        if (audioInsertError) throw audioInsertError
      }

      setMessage('Entrée dataset enregistrée avec succès.')
      setEntryType('word')
      setSourceLanguage('mina')
      setTargetLanguage('fr')
      setDomain('sante')
      setPos('nom')
      setSourceText('')
      setTranslationText('')
      setExampleSource('')
      setExampleTarget('')
      setIntent('')
      setContributorName('')
      setUploadedFile(null)
      recorder.reset()
    } catch (err) {
      setMessage(`Erreur : ${err.message}`)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h2 style={styles.sectionTitle}>Dataset linguistique</h2>

      <div style={styles.row}>
        <label style={styles.label}>
          Type d’entrée
          <select
            value={entryType}
            onChange={(e) => setEntryType(e.target.value)}
            style={styles.input}
          >
            <option value="word">Mot</option>
            <option value="phrase">Phrase</option>
          </select>
        </label>

        <label style={styles.label}>
          Langue source
          <select
            value={sourceLanguage}
            onChange={(e) => setSourceLanguage(e.target.value)}
            style={styles.input}
          >
            <option value="mina">Mina</option>
            <option value="bambara">Bambara</option>
          </select>
        </label>
      </div>

      <div style={styles.row}>
        <label style={styles.label}>
          Langue cible
          <select
            value={targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value)}
            style={styles.input}
          >
            <option value="fr">Français</option>
          </select>
        </label>

        <label style={styles.label}>
          Domaine
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            style={styles.input}
          >
            <option value="sante">Santé</option>
            <option value="commerce">Commerce</option>
            <option value="pharmacie">Pharmacie</option>
            <option value="salutation">Salutation</option>
          </select>
        </label>
      </div>

      <div style={styles.row}>
        <label style={styles.label}>
          Nature du mot
          <select
            value={entryType === 'phrase' ? 'expr' : pos}
            onChange={(e) => setPos(e.target.value)}
            style={styles.input}
            disabled={entryType === 'phrase'}
          >
            <option value="nom">Nom</option>
            <option value="verbe">Verbe</option>
            <option value="adj">Adjectif</option>
            <option value="adv">Adverbe</option>
            <option value="expr">Expression</option>
            <option value="autre">Autre</option>
          </select>
        </label>

        <label style={styles.label}>
          Intent
          <input
            type="text"
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            placeholder="facultatif"
            style={styles.input}
          />
        </label>
      </div>

      <label style={styles.label}>
        {entryType === 'phrase' ? 'Phrase source' : 'Mot source'}
        <input
          type="text"
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          placeholder={entryType === 'phrase' ? 'Phrase source' : 'Mot source'}
          style={styles.input}
        />
      </label>

      <label style={styles.label}>
        Traduction française
        <input
          type="text"
          value={translationText}
          onChange={(e) => setTranslationText(e.target.value)}
          placeholder="Traduction FR"
          style={styles.input}
        />
      </label>

      <label style={styles.label}>
        Exemple source
        <textarea
          value={exampleSource}
          onChange={(e) => setExampleSource(e.target.value)}
          rows={3}
          placeholder="Exemple en langue source"
          style={styles.textarea}
        />
      </label>

      <label style={styles.label}>
        Exemple traduit
        <textarea
          value={exampleTarget}
          onChange={(e) => setExampleTarget(e.target.value)}
          rows={3}
          placeholder="Exemple traduit en français"
          style={styles.textarea}
        />
      </label>

      <label style={styles.label}>
        Contributeur
        <input
          type="text"
          value={contributorName}
          onChange={(e) => setContributorName(e.target.value)}
          placeholder="Nom du contributeur"
          style={styles.input}
        />
      </label>

      <RecorderSection
        title="Audio principal"
        recorder={recorder}
        uploadedFile={uploadedFile}
        setUploadedFile={setUploadedFile}
        fileAccept="audio/*"
      />

      <button type="submit" disabled={loading} style={styles.button}>
        {loading ? 'Enregistrement...' : 'Créer entrée dataset'}
      </button>

      {message ? <p style={styles.message}>{message}</p> : null}
    </form>
  )
}

function UiAudioForm() {
  const [audioKey, setAudioKey] = useState('home_intro')
  const [lang, setLang] = useState('mina')
  const [title, setTitle] = useState('Accueil - Intro')
  const [uploadedFile, setUploadedFile] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const recorder = useAudioRecorder('ui', { mode: 'ui' })

  const finalAudioFile = useMemo(() => {
    return recorder.recordedFile || uploadedFile || null
  }, [recorder.recordedFile, uploadedFile])

  useEffect(() => {
    const selected = UI_AUDIO_KEYS.find((item) => item.value === audioKey)
    if (selected) {
      setTitle(selected.label)
    }
  }, [audioKey])

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')

    if (!audioKey.trim()) {
      setMessage("La clé audio est obligatoire.")
      return
    }

    if (!title.trim()) {
      setMessage("Le titre est obligatoire.")
      return
    }

    if (!finalAudioFile) {
      setMessage("Il faut enregistrer au micro ou charger un fichier audio.")
      return
    }

    setLoading(true)

    try {
      const ext = getExtensionFromFile(finalAudioFile)

      if (!['m4a', 'mp4'].includes(ext)) {
        throw new Error("Format non supporté pour l'audio UI. Utilise un fichier .m4a ou .mp4.")
      }

      const path = `ui_prompts/${lang}/${audioKey}-${Date.now()}.${ext}`

      console.log('UI AUDIO PATH =', path)

      const { error: uploadError } = await supabase
        .storage
        .from('lingua-audio')
        .upload(path, finalAudioFile, {
          upsert: true,
          contentType: 'audio/mp4',
        })

      if (uploadError) throw uploadError

      const payload = {
        key: audioKey.trim(),
        lang,
        title: title.trim(),
        storage_bucket: 'lingua-audio',
        storage_path: path,
        is_active: true,
      }

      const { data: existingRows, error: findError } = await supabase
        .from('ui_audio_prompts')
        .select('id')
        .eq('key', audioKey.trim())
        .eq('lang', lang)

      if (findError) throw findError

      if (existingRows && existingRows.length > 0) {
        const existingId = existingRows[0].id

        const { error: updateError } = await supabase
          .from('ui_audio_prompts')
          .update(payload)
          .eq('id', existingId)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('ui_audio_prompts')
          .insert([payload])

        if (insertError) throw insertError
      }

      setMessage('Audio UI Moulédi enregistré avec succès.')
      setAudioKey('home_intro')
      setLang('mina')
      setTitle('Accueil - Intro')
      setUploadedFile(null)
      recorder.reset()
    } catch (err) {
      setMessage(`Erreur : ${err.message}`)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h2 style={styles.sectionTitle}>Audios UI Moulédi</h2>

      <label style={styles.label}>
        Clé audio
        <select
          value={audioKey}
          onChange={(e) => setAudioKey(e.target.value)}
          style={styles.input}
        >
          {UI_AUDIO_KEYS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label} ({item.value})
            </option>
          ))}
        </select>
      </label>

      <div style={styles.row}>
        <label style={styles.label}>
          Langue
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            style={styles.input}
          >
            <option value="mina">Mina</option>
            <option value="bambara">Bambara</option>
            <option value="fr">Français</option>
            <option value="kabye">Kabyè</option>
          </select>
        </label>

        <label style={styles.label}>
          Titre
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre lisible"
            style={styles.input}
          />
        </label>
      </div>

      <div style={styles.infoBox}>
        <strong>À quoi sert cette clé ?</strong>
        <div style={{ marginTop: 6 }}>
          Exemple : <code>home_intro</code> est l’audio joué par l’app sur l’écran
          d’accueil si ton code Moulédi appelle cette clé.
        </div>
      </div>

      <RecorderSection
        title="Audio UI"
        recorder={recorder}
        uploadedFile={uploadedFile}
        setUploadedFile={setUploadedFile}
        fileAccept=".m4a,.mp4,audio/mp4"
      />

      <button type="submit" disabled={loading} style={styles.button}>
        {loading ? 'Enregistrement...' : 'Créer / mettre à jour audio UI'}
      </button>

      {message ? <p style={styles.message}>{message}</p> : null}
    </form>
  )
}

function RecorderSection({
  title,
  recorder,
  uploadedFile,
  setUploadedFile,
  fileAccept = 'audio/*',
}) {
  const previewUrl = useMemo(() => {
    if (recorder.audioUrl) return recorder.audioUrl
    if (!uploadedFile) return ''
    return URL.createObjectURL(uploadedFile)
  }, [recorder.audioUrl, uploadedFile])

  useEffect(() => {
    return () => {
      if (uploadedFile && previewUrl && !recorder.audioUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [uploadedFile, previewUrl, recorder.audioUrl])

  return (
    <div style={styles.recorderWrap}>
      <h3 style={styles.subTitle}>{title}</h3>

      <div style={styles.recorderButtons}>
        <button
          type="button"
          onClick={recorder.startRecording}
          disabled={recorder.isRecording}
          style={styles.secondaryButton}
        >
          Démarrer micro
        </button>

        <button
          type="button"
          onClick={recorder.stopRecording}
          disabled={!recorder.isRecording}
          style={styles.secondaryButton}
        >
          Stop
        </button>

        <button
          type="button"
          onClick={() => {
            recorder.reset()
            setUploadedFile(null)
          }}
          style={styles.secondaryButton}
        >
          Réinitialiser
        </button>
      </div>

      <div style={styles.smallText}>
        {recorder.isRecording
          ? `Enregistrement en cours... ${formatElapsed(recorder.elapsedMs)}`
          : recorder.error
            ? `Erreur micro : ${recorder.error}`
            : recorder.recordedFile
              ? `Audio micro prêt : ${recorder.recordedFile.name}`
              : uploadedFile
                ? `Fichier chargé : ${uploadedFile.name}`
                : 'Aucun audio sélectionné'}
      </div>

      <Meter level={recorder.level} active={recorder.isRecording} />

      {previewUrl && (
        <audio
          controls
          src={previewUrl}
          style={{ width: '100%', marginTop: 10 }}
        />
      )}

      <label style={{ ...styles.label, marginTop: 12 }}>
        Ou charger un fichier existant
        <input
          type="file"
          accept={fileAccept}
          onChange={(e) => {
            const file = e.target.files?.[0] || null
            setUploadedFile(file)
            if (file) recorder.reset()
          }}
          style={styles.fileInput}
        />
      </label>
    </div>
  )
}

function useAudioRecorder(prefix = 'audio', options = {}) {
  const { mode = 'dataset' } = options

  const mediaRecorderRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const animationFrameRef = useRef(null)
  const chunksRef = useRef([])
  const startedAtRef = useRef(null)

  const [isRecording, setIsRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState('')
  const [recordedBlob, setRecordedBlob] = useState(null)
  const [recordedFile, setRecordedFile] = useState(null)
  const [error, setError] = useState('')
  const [level, setLevel] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    return () => {
      cleanupAll()
    }
  }, [audioUrl])

  function cleanupMetering() {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    analyserRef.current = null
    setLevel(0)
  }

  function cleanupStream() {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }
  }

  function cleanupAll() {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    cleanupMetering()
    cleanupStream()
  }

  function startMetering() {
    if (!analyserRef.current) return

    const analyser = analyserRef.current
    const dataArray = new Uint8Array(analyser.fftSize)

    const tick = () => {
      analyser.getByteTimeDomainData(dataArray)

      let sum = 0
      for (let i = 0; i < dataArray.length; i += 1) {
        const normalized = (dataArray[i] - 128) / 128
        sum += normalized * normalized
      }

      const rms = Math.sqrt(sum / dataArray.length)
      const boosted = Math.min(1, rms * 4.5)
      setLevel(boosted)

      if (startedAtRef.current) {
        setElapsedMs(Date.now() - startedAtRef.current)
      }

      animationFrameRef.current = requestAnimationFrame(tick)
    }

    tick()
  }

  async function startRecording() {
  try {
    setError('')

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("L'enregistrement micro n'est pas supporté sur ce navigateur.")
    }

    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl('')
    setRecordedBlob(null)
    setRecordedFile(null)
    setElapsedMs(0)
    setLevel(0)
    chunksRef.current = []

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaStreamRef.current = stream

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext
    if (AudioContextCtor) {
      const audioContext = new AudioContextCtor()
      audioContextRef.current = audioContext
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)
      analyserRef.current = analyser
    }

    const mimeType = getSupportedMimeType(mode)

    if (mode === 'ui' && !mimeType) {
      cleanupAll()
      throw new Error(
        "Ce navigateur n'enregistre pas l'audio UI en format compatible (.m4a/.mp4). Charge directement un fichier .m4a."
      )
    }

    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined
    )

    mediaRecorderRef.current = recorder

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data)
      }
    }

    recorder.onstop = () => {
      const actualMimeType = recorder.mimeType || ''

      if (mode === 'ui' && !actualMimeType.includes('mp4') && !actualMimeType.includes('aac')) {
        setError("Le micro a produit un format non compatible pour l'audio UI. Utilise un fichier .m4a.")
        setIsRecording(false)
        cleanupMetering()
        cleanupStream()
        chunksRef.current = []
        return
      }

      const blobType =
        actualMimeType || (mode === 'ui' ? 'audio/mp4' : 'audio/webm')

      const blob = new Blob(chunksRef.current, { type: blobType })
      const url = URL.createObjectURL(blob)
      const ext = mimeToExtension(blobType, mode)
      const fileType = blobType || guessContentTypeFromExt(ext)

      const file = new File([blob], `${prefix}-${Date.now()}.${ext}`, {
        type: fileType,
      })

      setRecordedBlob(blob)
      setRecordedFile(file)
      setAudioUrl(url)
      setIsRecording(false)
      cleanupMetering()
      cleanupStream()
    }

    startedAtRef.current = Date.now()
    recorder.start()
    setIsRecording(true)
    startMetering()
  } catch (err) {
    console.error(err)
    setError(err.message || 'Impossible de démarrer le micro.')
    setIsRecording(false)
    cleanupAll()
  }
}

  function stopRecording() {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
    } catch (err) {
      console.error(err)
      setError(err.message || "Impossible d'arrêter l'enregistrement.")
    }
  }

  function reset() {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl('')
    setRecordedBlob(null)
    setRecordedFile(null)
    setError('')
    setLevel(0)
    setElapsedMs(0)
    chunksRef.current = []
    startedAtRef.current = null

    cleanupMetering()
    cleanupStream()

    if (mediaRecorderRef.current?.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop()
      } catch {
        // no-op
      }
    }

    setIsRecording(false)
  }

  return {
    isRecording,
    audioUrl,
    recordedBlob,
    recordedFile,
    error,
    level,
    elapsedMs,
    startRecording,
    stopRecording,
    reset,
  }
}

function formatElapsed(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

function Meter({ level = 0, active = false }) {
  const bars = Array.from({ length: 16 }, (_, i) => {
    const threshold = (i + 1) / 16
    const on = level >= threshold
    return (
      <div
        key={i}
        style={{
          width: 8,
          height: on ? 12 + i * 2 : 8,
          borderRadius: 999,
          background: active && on ? '#22c55e' : '#334155',
          transition: 'all 80ms linear',
        }}
      />
    )
  })

  return <div style={styles.meter}>{bars}</div>
}

function getSupportedMimeType(mode = 'dataset') {
  if (typeof MediaRecorder === 'undefined') return ''

  const uiCandidates = [
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/aac',
  ]

  const datasetCandidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]

  const candidates = mode === 'ui' ? uiCandidates : datasetCandidates

  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }

  return ''
}

function mimeToExtension(mimeType = '', mode = 'dataset') {
  if (mimeType.includes('mp4')) return 'm4a'
  if (mimeType.includes('aac')) return 'm4a'
  if (mimeType.includes('ogg')) return 'ogg'
  if (mode === 'ui') return 'm4a'
  return 'webm'
}

function getExtensionFromFile(file) {
  const byName = file.name?.split('.').pop()?.toLowerCase()
  if (byName && byName !== file.name) return byName

  const type = file.type || ''
  if (type.includes('mp4')) return 'm4a'
  if (type.includes('aac')) return 'm4a'
  if (type.includes('ogg')) return 'ogg'
  if (type.includes('webm')) return 'webm'

  return 'm4a'
}

function guessContentTypeFromExt(ext = '') {
  const cleanExt = ext.toLowerCase()

  if (cleanExt === 'm4a' || cleanExt === 'mp4') return 'audio/mp4'
  if (cleanExt === 'ogg') return 'audio/ogg'
  if (cleanExt === 'webm') return 'audio/webm'

  return 'application/octet-stream'
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0b1020',
    color: '#f8fafc',
    padding: '32px 16px',
    fontFamily: 'Arial, sans-serif',
  },
  card: {
    maxWidth: '820px',
    margin: '0 auto',
    background: '#11182b',
    border: '1px solid #24314d',
    borderRadius: '18px',
    padding: '24px',
    boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
  },
  title: {
    margin: '0 0 8px',
    fontSize: '44px',
    textAlign: 'center',
  },
  subtitle: {
    margin: '0 0 24px',
    textAlign: 'center',
    color: '#b8c4d6',
  },
  tabs: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  tabButton: {
    padding: '10px 16px',
    borderRadius: '10px',
    border: '1px solid #314764',
    background: '#0b1220',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  tabButtonActive: {
    background: '#2563eb',
    borderColor: '#2563eb',
  },
  sectionTitle: {
    margin: '0 0 8px',
  },
  subTitle: {
    margin: '0 0 8px',
    fontSize: '18px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '14px',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    fontSize: '14px',
  },
  input: {
    height: '44px',
    borderRadius: '10px',
    border: '1px solid #314764',
    background: '#0b1220',
    color: '#fff',
    padding: '0 12px',
    fontSize: '15px',
  },
  textarea: {
    borderRadius: '10px',
    border: '1px solid #314764',
    background: '#0b1220',
    color: '#fff',
    padding: '12px',
    fontSize: '15px',
    resize: 'vertical',
  },
  fileInput: {
    color: '#fff',
  },
  button: {
    height: '46px',
    borderRadius: '10px',
    border: 'none',
    background: '#2563eb',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: '15px',
    cursor: 'pointer',
  },
  secondaryButton: {
    height: '40px',
    padding: '0 14px',
    borderRadius: '10px',
    border: '1px solid #314764',
    background: '#0b1220',
    color: '#fff',
    cursor: 'pointer',
  },
  recorderWrap: {
    border: '1px solid #24314d',
    borderRadius: '14px',
    padding: '14px',
    background: '#0c1324',
  },
  recorderButtons: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  smallText: {
    marginTop: '10px',
    color: '#b8c4d6',
    fontSize: '14px',
  },
  meter: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 4,
    minHeight: 48,
    marginTop: 10,
    padding: '10px 12px',
    borderRadius: '10px',
    background: '#0b1220',
    border: '1px solid #24314d',
  },
  infoBox: {
    padding: '12px 14px',
    background: '#17233a',
    borderRadius: '10px',
    color: '#d7e2f0',
    fontSize: '14px',
  },
  message: {
    margin: 0,
    padding: '12px 14px',
    background: '#17233a',
    borderRadius: '10px',
    color: '#ffd27a',
    whiteSpace: 'pre-wrap',
  },
}