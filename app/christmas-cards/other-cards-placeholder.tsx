import CardArt from './card-art'

const PRAYER_CARDS = [
  {
    sku: 'CC-25-01',
    title: 'Mary Gentle Mother',
    cover: '/christmas-cards/other/CC-25-01_mary_gentle_mother_cover.jpg',
    inside: '/christmas-cards/other/CC-25-01_mary_gentle_mother_inside.jpg',
    outside: '/christmas-cards/other/CC-25-01_mary_gentle_mother_outside.jpg',
  },
  {
    sku: 'CC-25-02',
    title: 'Heart of Mary',
    cover: '/christmas-cards/other/CC-25-02_heart_of_mary_cover.jpg',
    inside: '/christmas-cards/other/CC-25-02_heart_of_mary_inside.jpg',
    outside: '/christmas-cards/other/CC-25-02_heart_of_mary_outside.jpg',
  },
  {
    sku: 'CC-25-03',
    title: 'Child of Wonder',
    cover: '/christmas-cards/other/CC-25-03_child_of_wonder_cover.jpg',
    inside: '/christmas-cards/other/CC-25-03_child_of_wonder_inside.jpg',
    outside: '/christmas-cards/other/CC-25-03_child_of_wonder_outside.jpg',
  },
  {
    sku: 'CC-25-04',
    title: 'Shepherds Adore',
    cover: '/christmas-cards/other/CC-25-04_shepherds_adore_cover.jpg',
    inside: '/christmas-cards/other/CC-25-04_shepherds_adore_inside.jpg',
    outside: '/christmas-cards/other/CC-25-04_shepherds_adore_outside.jpg',
  },
  {
    sku: 'CC-25-05',
    title: 'Star of Bethlehem',
    cover: '/christmas-cards/other/CC-25-05_star_of_bethlehem_cover.jpg',
    inside: '/christmas-cards/other/CC-25-05_star_of_bethlehem_inside.jpg',
    outside: '/christmas-cards/other/CC-25-05_star_of_bethlehem_outside.jpg',
  },
  {
    sku: 'CC-25-06',
    title: 'Madonna and Child',
    cover: '/christmas-cards/other/CC-25-06_madonna_and_child_cover.jpg',
    inside: '/christmas-cards/other/CC-25-06_madonna_and_child_inside.jpg',
    outside: '/christmas-cards/other/CC-25-06_madonna_and_child_outside.jpg',
  },
  {
    sku: 'CC-25-07',
    title: 'The Nativity',
    cover: '/christmas-cards/other/CC-25-07_the_nativity_cover.jpg',
    inside: '/christmas-cards/other/CC-25-07_the_nativity_inside.jpg',
    outside: '/christmas-cards/other/CC-25-07_the_nativity_outside.jpg',
  },
]

export default function OtherCardsPlaceholder() {
  return (
    <section className="ccic-other-cards-shell" aria-labelledby="other-cards-title">
      <div className="ccic-other-cards-inner">
        <div className="ccic-collection-heading">
          <h2 id="other-cards-title">Catholic Prayer Cards</h2>
          <p>Sold individually. Not included in case pricing.</p>
        </div>

        <div className="ccic-gallery-grid">
          {PRAYER_CARDS.map((card) => (
            <article className="ccic-gallery-card ccic-prayer-card" key={card.sku}>
              <CardArt
                title={card.title}
                imageUrl={card.cover}
                images={[
                  { label: 'Cover', url: card.cover },
                  { label: 'Inside', url: card.inside },
                  { label: 'Outside', url: card.outside },
                ]}
              />
              <div className="ccic-gallery-copy">
                <h3>{card.title}</h3>
                <p className="ccic-product-kicker">{card.sku}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
