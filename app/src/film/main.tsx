// Dev-only film renderer (not part of the production build). Open /film.html?film=teaser|demo.
// window.__seek(t) renders the exact frame at time t; scripts/film.mjs captures frames from it.
import { createRoot } from 'react-dom/client'
import '../index.css'
import '../layout.css'
import './film.css'
import { Film } from './Film'

createRoot(document.getElementById('root')!).render(<Film />)
