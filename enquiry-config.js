/* The Apps Script URL is public, but live email submission is enabled only on the published site. */
const harbourEndpoint='https://script.google.com/macros/s/AKfycbz3LnmwLwdvkREK89RCM5_3MaJmtQljIx9DeJIEARWRhqSkNFHy10u0psOiiA24p1Nvig/exec';
window.HARBOUR_AVAILABILITY_ENDPOINT=harbourEndpoint;
window.HARBOUR_ENQUIRY_ENDPOINT=window.location.hostname==='bgibbo.github.io'?harbourEndpoint:'';
