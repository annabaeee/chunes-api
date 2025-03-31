
export const fetchJson = async (url, options) => {

  const newOptions = options || {};
  if (!(newOptions.headers instanceof Headers)) {
    newOptions.headers = new Headers(newOptions.headers);
  }

  if (!newOptions.headers.has("Accept")) {
    newOptions.headers.set('Accept', 'application/json');
  }

  // Auto convert request data to body JSON and set request content type
  if (newOptions.data !== undefined) {
    newOptions.body = JSON.stringify(newOptions.data);
    newOptions.headers.set('Content-Type', 'application/json');
    delete newOptions.data;
  }

  const response = await fetch(url, newOptions);
  if (response.ok) {
    if (response.body) {
      const data = await response.json();
      response.data = data;
    }
    return response;
  }

  let errorDetails;
  const responseClone = response.clone(); // If json can't be read it has to be re-read as text
  if (response.body) {
    try {
      errorDetails = await response.json(); // SyntaxError: Unexpected token in JSON
    } catch {
      const errorText = await responseClone.text(); // response clone can still read as a fallback
      errorDetails = {
        message: errorText
      };
    }

    if (response.status === 429 && response.headers.has('Retry-After')){
      errorDetails.retryAfter = response.headers.get('Retry-After');
    }

    errorDetails.status = response.status;
    errorDetails.statusText = response.statusText;
    response.data = errorDetails;
  }

  return response;
}