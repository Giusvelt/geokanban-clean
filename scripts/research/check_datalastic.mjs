const key = '6ea4aeac-a55d-4071-874e-7b794b1e5ec6';
fetch('https://api.datalastic.com/api/v0/vessel_inradius?api-key=' + key + '&lat=44.383&lon=8.933&radius=10')
    .then(r => r.json())
    .then(d => {
        console.dir(d, { depth: 2 });
    });
