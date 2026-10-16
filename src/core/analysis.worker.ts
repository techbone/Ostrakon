import { analyze } from "./analyze";
import { datasetSchema } from "./schema";

self.onmessage = (event: MessageEvent) => {
  try {
    self.postMessage({
      id: event.data.id,
      result: analyze(
        datasetSchema.parse(event.data.dataset),
        event.data.parameters,
      ),
    });
  } catch {
    self.postMessage({
      id: event.data.id,
      error:
        "The dataset could not be analyzed. Check its format and rule parameters.",
    });
  }
};
