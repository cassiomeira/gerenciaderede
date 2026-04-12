import axios from 'axios';

const IXC_TOKEN = "1:72e20a330f2b146983dfb2f66a8f05186649b74db9f43aebf86068c13c6156c3";
const IXC_URL = "https://sis.netcartelecom.com.br/webservice/v1";

async function test() {
  const enc = Buffer.from(IXC_TOKEN).toString('base64');
  console.log('Testing with Basic Auth...');
  
  try {
    const response = await axios.post(`${IXC_URL}/cliente`, {
      qtype: 'cliente.login',
      query: 'Cassiofibra',
      oper: '=',
      page: '1',
      rp: '1'
    }, {
      headers: {
        'Authorization': 'Basic ' + enc,
        'Content-Type': 'application/json'
      }
    });
    console.log('Response with Basic Auth:', response.status);
    console.log('Data:', JSON.stringify(response.data).substring(0, 200));
  } catch (e: any) {
    console.log('Basic Auth failed:', e.message);
    if (e.response) console.log('Response data:', e.response.data);
  }

  console.log('\nTesting with custom ixcsoft header...');
  try {
    const response = await axios.post(`${IXC_URL}/cliente`, {
      qtype: 'cliente.login',
      query: 'Cassiofibra',
      oper: '=',
      page: '1',
      rp: '1'
    }, {
      headers: {
        'ixcsoft': 'listar',
        'Authorization': 'Basic ' + enc,
        'Content-Type': 'application/json'
      }
    });
    console.log('Response with custom header:', response.status);
  } catch (e: any) {
    console.log('Custom header failed:', e.message);
  }
}

test();
