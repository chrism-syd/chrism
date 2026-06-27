import Link from 'next/link'

type PublicEvent = {
  id: string
  date: string
  title: string
  meta: string
}

type PublicEventsProps = {
  events: PublicEvent[]
  eventsHref: string
}

export default function PublicEvents({ events, eventsHref }: PublicEventsProps) {
  if (events.length === 0) return null

  return (
    <section id="events" className="local-page-section">
      <div className="local-page-section-head">
        <div>
          <h2 className="qv-section-title local-page-section-title-tight">Upcoming events</h2>
          <p className="qv-section-subtitle local-page-section-subtitle-tight">
            A quick look at what is coming up next.
          </p>
        </div>
        <Link href={eventsHref} className="qv-link-button qv-button-secondary">View all events</Link>
      </div>

      <div className="local-page-events-list">
        {events.map((event) => (
          <div key={event.id} className="local-page-event-row">
            <div className="local-page-event-date">{event.date}</div>
            <div>
              <div className="local-page-event-title">{event.title}</div>
              <span className="local-page-event-meta">{event.meta}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
