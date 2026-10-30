import './App.css'

const nextSteps = [
  {
    number: '01',
    title: 'Choose the inputs',
    description: 'Decide what information a new course needs.',
  },
  {
    number: '02',
    title: 'Generate a course',
    description: 'Add the generation logic and display the result.',
  },
  {
    number: '03',
    title: 'Save or export',
    description: 'Make the finished course easy to share.',
  },
]

function App() {
  return (
    <div className="app">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Spritorienteering Generator home">
          <span className="brand-mark" aria-hidden="true">↗</span>
          <span>Spritorienteering<span className="brand-light"> Generator</span></span>
        </a>
        <span className="header-tag">React starter</span>
      </header>

      <main className="main-content">
        <section className="hero" aria-labelledby="hero-title">
          <div className="eyebrow"><span className="eyebrow-dot" /> YOUR PROJECT STARTS HERE</div>
          <h1 id="hero-title">A new way to <em>find your way.</em></h1>
          <p>
            Welcome to Spritorienteering Generator. This is the foundation for
            creating routes, generating courses, and sharing the adventure.
          </p>
        </section>

        <section className="workspace" aria-labelledby="workspace-title">
          <div className="workspace-header">
            <div>
              <span className="section-kicker">WORKSPACE</span>
              <h2 id="workspace-title">Generator</h2>
            </div>
            <span className="status"><span className="status-dot" /> Ready for development</span>
          </div>

          <div className="workspace-body">
            <div className="compass-icon" aria-hidden="true">✳</div>
            <h3>Your generator will live here.</h3>
            <p>
              The React app is set up. Next, we'll add the actual inputs and
              generation logic, one feature at a time.
            </p>
          </div>
        </section>

        <section className="roadmap" aria-labelledby="roadmap-title">
          <div className="roadmap-intro">
            <span className="section-kicker">WHAT'S NEXT</span>
            <h2 id="roadmap-title">From idea to adventure.</h2>
          </div>
          <ol className="steps">
            {nextSteps.map((step) => (
              <li className="step" key={step.number}>
                <span className="step-number">{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="site-footer">
        <span>Spritorienteering Generator</span>
        <span>Built with React + Vite</span>
      </footer>
    </div>
  )
}

export default App
