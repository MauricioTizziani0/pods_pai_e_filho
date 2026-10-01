import { revalidatePath } from "next/cache";

export function revalidateCommerce() {
  revalidatePath("/", "layout");
}
