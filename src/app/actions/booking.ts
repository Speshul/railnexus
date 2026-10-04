"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { bookingSchema, cancelDraft, createDraftBooking, deleteSavedPassenger, validateBooking } from "@/lib/booking";

export type BookingFormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

export async function createBooking(_: BookingFormState, form: FormData): Promise<BookingFormState> {
  const user = await getUser();
  if (!user) return { error: "Your session has expired. Please sign in again." };

  let payload: unknown;
  try {
    payload = JSON.parse(String(form.get("payload") ?? ""));
  } catch {
    return { error: "Invalid form submission." };
  }
  const parsed = bookingSchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return { error: "Please check the highlighted fields.", fieldErrors };
  }
  const result = validateBooking(parsed.data);
  if (!result.ok) return { error: result.error, fieldErrors: result.fieldErrors };

  const id = createDraftBooking(user, parsed.data, result);
  redirect(`/booking/${id}`);
}

export async function cancelHold(id: string) {
  const user = await getUser();
  if (!user) redirect("/login");
  cancelDraft(id, user.id);
  revalidatePath(`/booking/${id}`);
}

export async function removeSavedPassenger(id: number) {
  const user = await getUser();
  if (!user) return;
  deleteSavedPassenger(id, user.id);
  revalidatePath("/account");
}
