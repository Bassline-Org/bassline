// Test bassline export API
const formData = new FormData();
formData.append('groupId', 'root');
formData.append('includeValues', 'true');
formData.append('exportAll', 'false');

fetch('http://localhost:5173/api/bassline/export', {
  method: 'POST',
  body: formData
})
.then(res => res.json())
.then(data => {
  if (data.success) {
    console.log('Export successful!');
    console.log('Filename:', data.filename);
    console.log('Bassline:', JSON.parse(data.bassline));
  } else {
    console.error('Export failed:', data.error);
  }
})
.catch(err => console.error('Request failed:', err));