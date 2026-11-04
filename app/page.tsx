import DemoApp from "../components/demo-app";
import ConnectedApp from "../components/connected-app";
export default function Home() {
  return process.env.NEXT_PUBLIC_APP_MODE === "connected" ? (
    <ConnectedApp />
  ) : (
    <DemoApp />
  );
}
