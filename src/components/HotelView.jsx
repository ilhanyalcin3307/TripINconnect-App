import React from 'react';

const CAT_COLORS = {
  seyahat: '#0098ff',
  yemek: '#ff6b35',
  konaklama: '#a855f7',
  pazarlama: '#00e5a0',
  diğer: '#ffd60a'
};

const CAT_EMOJI = {
  seyahat: '✈',
  yemek: '🍽',
  konaklama: '🏨',
  pazarlama: '📢',
  diğer: '📦'
};

function HotelView({ expenses }) {
  const hotelData = {};
  
  expenses.forEach(e => {
    const hotel = e.otel || 'Genel';
    if (!hotelData[hotel]) {
      hotelData[hotel] = { total: 0, count: 0, categories: {} };
    }
    hotelData[hotel].total += parseFloat(e.tutar);
    hotelData[hotel].count++;
    
    if (!hotelData[hotel].categories[e.kategori]) {
      hotelData[hotel].categories[e.kategori] = 0;
    }
    hotelData[hotel].categories[e.kategori] += parseFloat(e.tutar);
  });

  const sortedHotels = Object.entries(hotelData).sort((a, b) => b[1].total - a[1].total);

  return (
    <div>
      <div className="section-title" style={{ marginBottom: '16px' }}>
        Otel Bazlı Harcamalar
      </div>
      
      {sortedHotels.length === 0 ? (
        <div className="empty-state" style={{ fontSize: '14px', fontWeight: '500' }}>
          Henüz veri yok
        </div>
      ) : (
        <div className="hotel-grid">
          {sortedHotels.map(([hotel, data]) => (
            <div key={hotel} className="hotel-card">
              <div className="hotel-name">🏨 {hotel}</div>
              <div className="hotel-total">€{data.total.toFixed(0)}</div>
              <div className="hotel-count">{data.count} fiş</div>
              
              {Object.entries(data.categories).map(([cat, amt]) => (
                <div key={cat} className="hotel-cat-item">
                  <span className="hotel-cat-name">
                    {CAT_EMOJI[cat]} {cat}
                  </span>
                  <span 
                    className="hotel-cat-amt" 
                    style={{ color: CAT_COLORS[cat] }}
                  >
                    €{amt.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default HotelView;
