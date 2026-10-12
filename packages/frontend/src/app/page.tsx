import Link from 'next/link';

const CAPABILITIES = [
  {
    id: 'view',
    title: 'Signals',
    body: 'A responsive multichannel viewer with channel grouping, time navigation, amplitude scaling, and event markers — plus filtering previews that never touch the stored recording.',
    points: [
      'Channel browser with explicit types and units',
      'Event markers reconciled to a recorded time base',
      'Multiresolution summaries for fast navigation',
    ],
  },
  {
    id: 'analyse',
    title: 'Analyse',
    body: 'Run versioned MNE-Python pipelines in isolated containers — filtering, epoching, evoked responses, spectral analysis — with explicit resource limits and honest status feedback.',
    points: [
      'Immutable pipeline versions pinned by image digest',
      'Parameters rendered from a typed schema with units',
      'Streamed logs that never leak credentials or raw signals',
    ],
  },
  {
    id: 'sensors',
    title: 'Sensors',
    body: 'Inspect sensor positions, orientations, and coordinate frames in 3D — essential for OPM-MEG where sensor geometry is flexible and can vary between recordings.',
    points: [
      'Declared coordinate frame and units for every layout',
      'Sensor type and channel mapping visible together',
      'OPM movement metadata where tracking data exists',
    ],
  },
];

const TRUST_POINTS = ['SQUID-MEG + OPM-MEG', 'MNE-Python powered', 'SHA-256 provenance'];

const SampleTrace = () => {
  return (
    <div className='signal-bg border-border overflow-hidden rounded-lg border'>
      <svg
        viewBox='0 0 320 220'
        className='block w-full'
        role='img'
        aria-label='Sample MEG recording thumbnail'>
        <rect width='320' height='220' fill='#05080B' />
        <g stroke='#1A2230'>
          <line x1='160' y1='0' x2='160' y2='220' />
          <line x1='0' y1='110' x2='320' y2='110' />
        </g>
        <g fill='none' stroke='#4C8DFF' strokeWidth='1.1'>
          <polyline points='18,60 58,64 98,58 138,66 178,60 218,74 258,66 300,80' />
          <polyline points='18,100 58,104 98,98 138,106 178,100 218,114 258,106 300,120' />
          <polyline points='18,140 58,144 98,138 138,146 178,140 218,154 258,146 300,160' />
          <polyline points='18,180 58,184 98,178 138,186 178,180 218,194 258,186 300,200' />
        </g>
        <g stroke='#D9A441' strokeDasharray='2 3'>
          <line x1='178' y1='30' x2='178' y2='192' />
        </g>
        <text x='14' y='26' fill='#6B7A90' fontSize='11' fontFamily='monospace'>
          AEF-sample · FIF · Neuromag
        </text>
      </svg>
    </div>
  );
};

const HeroSignal = () => {
  const traces = [60, 110, 160, 210, 260, 310, 360];
  return (
    <div className='signal-bg border-border overflow-hidden rounded-lg border'>
      <svg
        viewBox='0 0 640 400'
        className='block w-full'
        role='img'
        aria-label='Multichannel MEG signal preview with event markers and sensor layout'>
        <rect width='640' height='400' fill='#05080B' />
        <g stroke='#1A2230' strokeWidth='1'>
          <line x1='0' y1='196' x2='640' y2='196' />
          <line x1='470' y1='196' x2='470' y2='400' />
        </g>
        <g fontFamily='monospace' fontSize='11' fill='#6B7A90'>
          <text x='24' y='20'>
            RECORDING
          </text>
          <text x='52' y='172' fill='#6B7A90' fontSize='10'>
            MEG 011
          </text>
          <text x='52' y='382' fill='#6B7A90' fontSize='10'>
            MEG 086
          </text>
          <text x='24' y='392' fontSize='10'>
            -0.2 s
          </text>
          <text x='300' y='392' fontSize='10'>
            1.0 s
          </text>
          <text x='452' y='392' fontSize='10'>
            2.0 s
          </text>
        </g>
        <line x1='46' y1='30' x2='46' y2='386' stroke='#1A2230' />
        <g fill='none' stroke='#4C8DFF' strokeWidth='1.1'>
          {traces.map((y, index) => (
            <polyline
              key={y}
              opacity={Math.max(0.4, 1 - index * 0.09)}
              points={`50,${y} 80,${y + 2} 110,${y - 2} 140,${y + 4} 170,${y} 200,${y + 10} 230,${y + 6} 260,${y + 12} 290,${y + 8} 320,${y + 18} 350,${y + 14} 380,${y + 20} 410,${y + 16} 440,${y + 24} 470,${y + 20} 500,${y + 28} 530,${y + 24} 560,${y + 32} 590,${y + 28}`}
            />
          ))}
        </g>
        <g stroke='#D9A441' strokeWidth='1' strokeDasharray='3 3'>
          <line x1='200' y1='28' x2='200' y2='392' />
          <line x1='350' y1='28' x2='350' y2='392' />
          <line x1='470' y1='28' x2='470' y2='392' />
        </g>
        <g fontFamily='monospace' fontSize='10' fill='#D9A441'>
          <text x='178' y='20'>
            STIM
          </text>
          <text x='332' y='20'>
            STIM2
          </text>
        </g>
        <g>
          <rect x='488' y='210' width='140' height='176' rx='4' fill='#0B0F14' stroke='#263244' />
          <text x='496' y='230' fill='#9BA9BC' fontFamily='monospace' fontSize='10'>
            SENSOR LAYOUT
          </text>
          <g fill='#2A3648'>
            {[
              [514, 252],
              [532, 246],
              [550, 252],
              [526, 268],
              [544, 268],
              [514, 284],
              [532, 284],
              [550, 284],
              [526, 300],
              [544, 300],
              [520, 316],
              [538, 316],
              [556, 316],
              [526, 332],
              [544, 332],
              [560, 268],
              [574, 284],
              [568, 316],
              [582, 300],
              [508, 332],
              [588, 352],
              [570, 352],
              [552, 352],
              [534, 352],
              [516, 352],
              [498, 352],
              [610, 332],
            ].map(([cx, cy]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r='3' />
            ))}
          </g>
          <g fill='#4C8DFF'>
            <circle cx='514' cy='368' r='2.5' />
            <circle cx='610' cy='368' r='2.5' />
            <circle cx='562' cy='368' r='2.5' />
          </g>
          <text x='496' y='382' fill='#6B7A90' fontFamily='monospace' fontSize='9'>
            102 mag · 204 grad
          </text>
        </g>
      </svg>
    </div>
  );
};

const LandingPage = () => {
  return (
    <div className='bg-background min-h-screen'>
      <header className='border-border bg-background/85 sticky top-0 z-30 border-b backdrop-blur'>
        <div className='mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6'>
          <Link href='/' className='flex items-center gap-2.5'>
            <span
              aria-hidden='true'
              className='bg-accent text-background flex h-7 w-7 items-center justify-center rounded-md text-[13px] font-bold'>
              M
            </span>
            <span className='text-text-primary text-[15px] font-semibold tracking-tight'>
              MEG Lab
            </span>
          </Link>
          <nav className='text-text-secondary hidden items-center gap-1 text-[13px] md:flex'>
            <a href='#view' className='hover:text-text-primary rounded-md px-3 py-2'>
              Signals
            </a>
            <a href='#analyse' className='hover:text-text-primary rounded-md px-3 py-2'>
              Analyse
            </a>
            <a href='#sensors' className='hover:text-text-primary rounded-md px-3 py-2'>
              Sensors
            </a>
            <Link href='/app/explore' className='hover:text-text-primary rounded-md px-3 py-2'>
              Explore
            </Link>
          </nav>
          <div className='flex items-center gap-2'>
            <Link
              href='/login'
              className='text-text-secondary hover:text-text-primary px-3 text-[13px] font-medium'>
              Sign in
            </Link>
            <Link href='/app/explore' className='btn btn-primary btn-sm'>
              Open sample recording
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className='border-border relative overflow-hidden border-b'>
          <div className='bg-accent-muted pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full opacity-40 blur-3xl' />
          <div className='relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.05fr_.95fr]'>
            <div>
              <div className='border-border bg-surface-muted text-text-secondary mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-medium'>
                <span aria-hidden='true' className='bg-success h-1.5 w-1.5 rounded-full' />
                Open-source · Research and educational tool
              </div>
              <h1 className='text-text-primary text-[40px] leading-[46px] font-bold tracking-tight md:text-[52px] md:leading-[58px]'>
                Go from a raw MEG recording to an interpretable, reproducible neural signal analysis
                in the cloud.
              </h1>
              <p className='text-text-secondary mt-5 max-w-xl text-[16px] leading-7'>
                MEG Lab is a cloud electrophysiology workbench for magnetoencephalography: a
                responsive signal viewer, versioned analysis pipelines, explicit sensor geometry,
                and machine-readable experiment manifests. No server to configure, no analysis to
                reproduce by hand.
              </p>
              <div className='mt-8 flex flex-wrap items-center gap-3'>
                <Link href='/app/explore' className='btn btn-primary h-11 px-5 text-[14px]'>
                  Explore the sample recording
                </Link>
                <Link href='/login' className='btn btn-outline h-11 px-5 text-[14px]'>
                  Sign in
                </Link>
              </div>
              <div className='text-text-muted mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px]'>
                {TRUST_POINTS.map((point) => (
                  <span key={point} className='inline-flex items-center gap-1.5'>
                    <svg
                      viewBox='0 0 24 24'
                      fill='none'
                      stroke='currentColor'
                      strokeWidth='2'
                      className='h-3.5 w-3.5'>
                      <path d='m20 6-11 11-5-5' />
                    </svg>
                    {point}
                  </span>
                ))}
              </div>
            </div>

            <div className='card border-border bg-surface rounded-xl border p-3 shadow-[var(--shadow-elevation-3)]'>
              <div className='flex items-center justify-between px-1 pb-2'>
                <div className='flex items-center gap-2'>
                  <span aria-hidden='true' className='bg-danger h-2.5 w-2.5 rounded-full' />
                  <span aria-hidden='true' className='bg-warning h-2.5 w-2.5 rounded-full' />
                  <span aria-hidden='true' className='bg-success h-2.5 w-2.5 rounded-full' />
                  <span className='text-text-muted ml-2 text-[12px]'>
                    signal viewer — sample AEF / FIF
                  </span>
                </div>
                <span className='bg-success-muted text-success rounded-full px-2.5 py-0.5 text-[12px] font-medium'>
                  validated
                </span>
              </div>
              <HeroSignal />
            </div>
          </div>
        </section>

        <section id='view' className='mx-auto max-w-6xl px-4 py-16 sm:px-6'>
          <div className='mb-10 max-w-2xl'>
            <div className='text-text-muted mb-2 text-[12px] font-semibold tracking-wider uppercase'>
              Capabilities
            </div>
            <h2 className='text-text-primary text-[28px] leading-9 font-semibold tracking-tight'>
              Signals, sensors, and science on the same project and artifact system
            </h2>
            <p className='text-text-secondary mt-2 text-[14px]'>
              Display transforms are never recorded as analytical inputs. The recording is the
              primary content; everything else recedes.
            </p>
          </div>
          <div className='grid gap-6 md:grid-cols-3'>
            {CAPABILITIES.map((capability) => (
              <div
                key={capability.id}
                id={capability.id}
                className='card border-border bg-surface rounded-lg border p-6'>
                <h3 className='text-text-primary text-[18px] font-semibold'>{capability.title}</h3>
                <p className='text-text-secondary mt-2 text-[14px]'>{capability.body}</p>
                <ul className='text-text-secondary mt-4 space-y-2 text-[13px]'>
                  {capability.points.map((point) => (
                    <li key={point} className='flex items-start gap-2'>
                      <span
                        aria-hidden='true'
                        className='bg-accent mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full'
                      />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className='border-border bg-surface/40 border-t'>
          <div className='mx-auto max-w-6xl px-4 py-16 sm:px-6'>
            <div className='mb-8 max-w-2xl'>
              <div className='text-text-muted mb-2 text-[12px] font-semibold tracking-wider uppercase'>
                Start without uploading anything
              </div>
              <h2 className='text-text-primary text-[28px] leading-9 font-semibold tracking-tight'>
                Public sample project
              </h2>
            </div>
            <div className='card border-border bg-surface grid gap-6 rounded-xl border p-6 md:grid-cols-[1fr_1.2fr]'>
              <SampleTrace />
              <div>
                <div className='flex flex-wrap items-center gap-2'>
                  <h3 className='text-text-primary text-[18px] font-semibold'>
                    Sample Auditory Evoked Fields — FIF
                  </h3>
                  <span className='bg-accent-muted text-accent inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium'>
                    public sample
                  </span>
                  <span className='bg-success-muted text-success inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium'>
                    <span aria-hidden='true' className='h-1.5 w-1.5 rounded-full bg-current' />
                    validated
                  </span>
                </div>
                <p className='text-text-secondary mt-3 text-[14px]'>
                  A short anonymised auditory evoked fields recording from the MNE sample data, with
                  306 MEG channels, two stimulus conditions, and a matching event file. Explore it
                  read-only, then sign in to save a view or run an event-related analysis.
                </p>
                <dl className='mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-[13px] sm:grid-cols-3'>
                  {[
                    ['Format', 'FIF'],
                    ['Duration', '4 min'],
                    ['Sampling rate', '1000 Hz'],
                    ['Channels', '306 MEG + 9'],
                    ['System', 'Neuromag SQUID'],
                    ['Coordinate frame', 'head'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className='text-text-muted'>{label}</dt>
                      <dd className='text-text-primary mt-0.5 font-mono'>{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className='border-border bg-surface-muted text-text-secondary mt-5 rounded-md border p-3 font-mono text-[12px] leading-5'>
                  sha256:6f1c2a7b4e…a204e8c6b11f5d93
                </div>
                <p className='text-text-muted mt-4 text-[12px] leading-5'>
                  Source: MNE-Python sample data (BSD-3-Clause). Attribution is shown with the
                  sample and is never hidden behind an interaction. Not for clinical use.
                </p>
                <div className='mt-5 flex flex-wrap gap-3'>
                  <Link href='/app/explore' className='btn btn-primary btn-sm'>
                    Open sample recording
                  </Link>
                  <a href='#' className='btn btn-outline btn-sm'>
                    Read the citation
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className='border-border border-t'>
          <div className='mx-auto max-w-6xl px-4 py-16 sm:px-6'>
            <div className='card border-border from-surface to-accent-muted/40 flex flex-col items-start justify-between gap-6 rounded-xl border bg-gradient-to-br p-8 md:flex-row md:items-center'>
              <div className='max-w-xl'>
                <h2 className='text-text-primary text-[22px] leading-8 font-semibold'>
                  From “I found an MEG recording” to a shareable result
                </h2>
                <p className='text-text-secondary mt-2 text-[14px]'>
                  Create a project, upload a supported recording, open the Signal Viewer, and run
                  your first event-related analysis in minutes.
                </p>
              </div>
              <div className='flex flex-wrap gap-3'>
                <Link href='/login' className='btn btn-primary h-11 px-5 text-[14px]'>
                  Create an account
                </Link>
                <Link href='/app/explore' className='btn btn-outline h-11 px-5 text-[14px]'>
                  Open sample recording
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className='border-border bg-surface/40 border-t'>
        <div className='mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4'>
          <div>
            <div className='flex items-center gap-2.5'>
              <span
                aria-hidden='true'
                className='bg-accent text-background flex h-7 w-7 items-center justify-center rounded-md text-[13px] font-bold'>
                M
              </span>
              <span className='text-text-primary text-[15px] font-semibold tracking-tight'>
                MEG Lab
              </span>
            </div>
            <p className='text-text-muted mt-3 max-w-xs text-[13px]'>
              A cloud-based computational electrophysiology workbench for developers, computational
              neuroscientists, and neuroscience enthusiasts.
            </p>
          </div>
          <div>
            <div className='text-text-muted text-[12px] font-semibold tracking-wider uppercase'>
              Product
            </div>
            <ul className='text-text-secondary mt-3 space-y-2 text-[13px]'>
              <li>
                <a href='#view' className='hover:text-text-primary'>
                  Signal Viewer
                </a>
              </li>
              <li>
                <a href='#analyse' className='hover:text-text-primary'>
                  Pipelines
                </a>
              </li>
              <li>
                <a href='#sensors' className='hover:text-text-primary'>
                  Sensor Explorer
                </a>
              </li>
              <li>
                <Link href='/app/explore' className='hover:text-text-primary'>
                  Explore samples
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <div className='text-text-muted text-[12px] font-semibold tracking-wider uppercase'>
              Documentation
            </div>
            <ul className='text-text-secondary mt-3 space-y-2 text-[13px]'>
              <li>
                <a href='#' className='hover:text-text-primary'>
                  Getting started
                </a>
              </li>
              <li>
                <a href='#' className='hover:text-text-primary'>
                  Formats and BIDS MEG
                </a>
              </li>
              <li>
                <a href='#' className='hover:text-text-primary'>
                  REST API
                </a>
              </li>
              <li>
                <a href='#' className='hover:text-text-primary'>
                  Python SDK
                </a>
              </li>
            </ul>
          </div>
          <div>
            <div className='text-text-muted text-[12px] font-semibold tracking-wider uppercase'>
              Legal
            </div>
            <ul className='text-text-secondary mt-3 space-y-2 text-[13px]'>
              <li>
                <a href='#' className='hover:text-text-primary'>
                  Licence
                </a>
              </li>
              <li>
                <a href='#' className='hover:text-text-primary'>
                  Privacy policy
                </a>
              </li>
              <li>
                <a href='#' className='hover:text-text-primary'>
                  Terms of use
                </a>
              </li>
              <li>
                <a href='#' className='hover:text-text-primary'>
                  Citation
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className='border-border border-t'>
          <div className='text-text-muted mx-auto flex max-w-6xl flex-col justify-between gap-2 px-4 py-5 text-[12px] sm:px-6 md:flex-row'>
            <span>© 2026 MEG Lab · Research and educational use only. Not a medical device.</span>
            <span className='font-mono'>v0.1.0 · prototype</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
