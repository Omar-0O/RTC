import { Outlet } from 'react-router-dom';

export default function Caravans() {
    return (
        <div className="w-full py-6 animate-in fade-in duration-500">
            <Outlet />
        </div>
    );
}
